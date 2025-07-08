// Enhanced Input Validation and Sanitization Middleware
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Security patterns for detection
export const SECURITY_PATTERNS = {
  SQL_INJECTION: [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)|('|('')|;|--|\|\/\*|\*\/)/i,
    /(\b(or|and)\b\s*(\d+\s*=\s*\d+|'[^']*'\s*=\s*'[^']*'))/i,
    /(benchmark|sleep|waitfor|delay)\s*\(/i,
  ],
  XSS: [
    /<script[^>]*>[\s\S]*?<\/script>/i,
    /<iframe[^>]*>[\s\S]*?<\/iframe>/i,
    /javascript\s*:/i,
    /on\w+\s*=\s*["'][^"']*["']/i,
    /<svg[^>]*>[\s\S]*?<\/svg>/i,
    /<object[^>]*>[\s\S]*?<\/object>/i,
    /<embed[^>]*>/i,
    /<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/i,
  ],
  PATH_TRAVERSAL: [
    /\.\.[\\/]/,
    /%2e%2e[\\/]/i,
    /\.\.%2f/i,
    /%2e%2e%2f/i,
    /\.\.%5c/i,
    /%2e%2e%5c/i,
  ],
  COMMAND_INJECTION: [
    /[;&|`$(){}[\]]/,
    /(^|\s)(cat|ls|pwd|id|whoami|ps|netstat|ifconfig|ping|nmap|curl|wget|nc|telnet)\s/i,
    /\$\([^)]+\)/,
    /`[^`]+`/,
  ],
  LDAP_INJECTION: [
    /[()&|!]/,
    /\*\)/,
    /\(\|/,
    /\(&/,
    /\(!/,
  ],
  XML_INJECTION: [
    /<!DOCTYPE/i,
    /<!ENTITY/i,
    /<!\[CDATA\[/i,
    /&\w+;/,
  ],
  NOSQL_INJECTION: [
    /\$where/i,
    /\$ne/i,
    /\$gt/i,
    /\$gte/i,
    /\$lt/i,
    /\$lte/i,
    /\$in/i,
    /\$nin/i,
    /\$regex/i,
  ],
};

// Enhanced validation functions
export class SecurityValidator {
  /**
   * Check if input contains potential security threats
   */
  static detectThreats(input: string): { 
    isSecure: boolean; 
    threats: string[]; 
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  } {
    const threats: string[] = [];
    let maxRiskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check SQL injection
    if (SECURITY_PATTERNS.SQL_INJECTION.some(pattern => pattern.test(input))) {
      threats.push('SQL_INJECTION');
      maxRiskLevel = 'critical';
    }

    // Check XSS
    if (SECURITY_PATTERNS.XSS.some(pattern => pattern.test(input))) {
      threats.push('XSS');
      if (maxRiskLevel !== 'critical') maxRiskLevel = 'high';
    }

    // Check path traversal
    if (SECURITY_PATTERNS.PATH_TRAVERSAL.some(pattern => pattern.test(input))) {
      threats.push('PATH_TRAVERSAL');
      if (!['critical', 'high'].includes(maxRiskLevel)) maxRiskLevel = 'high';
    }

    // Check command injection
    if (SECURITY_PATTERNS.COMMAND_INJECTION.some(pattern => pattern.test(input))) {
      threats.push('COMMAND_INJECTION');
      maxRiskLevel = 'critical';
    }

    // Check LDAP injection
    if (SECURITY_PATTERNS.LDAP_INJECTION.some(pattern => pattern.test(input))) {
      threats.push('LDAP_INJECTION');
      if (!['critical', 'high'].includes(maxRiskLevel)) maxRiskLevel = 'medium';
    }

    // Check XML injection
    if (SECURITY_PATTERNS.XML_INJECTION.some(pattern => pattern.test(input))) {
      threats.push('XML_INJECTION');
      if (!['critical', 'high'].includes(maxRiskLevel)) maxRiskLevel = 'medium';
    }

    // Check NoSQL injection
    if (SECURITY_PATTERNS.NOSQL_INJECTION.some(pattern => pattern.test(input))) {
      threats.push('NOSQL_INJECTION');
      if (!['critical', 'high', 'medium'].includes(maxRiskLevel)) maxRiskLevel = 'medium';
    }

    return {
      isSecure: threats.length === 0,
      threats,
      riskLevel: maxRiskLevel,
    };
  }

  /**
   * Advanced input sanitization
   */
  static sanitizeInput(input: string, options: {
    allowHtml?: boolean;
    allowNewlines?: boolean;
    maxLength?: number;
    encoding?: 'html' | 'url' | 'base64';
  } = {}): string {
    const { allowHtml = false, allowNewlines = true, maxLength = 10000, encoding = 'html' } = options;

    let sanitized = input;

    // Truncate if too long
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Handle newlines
    if (!allowNewlines) {
      sanitized = sanitized.replace(/[\r\n]/g, ' ');
    }

    // HTML encoding
    if (!allowHtml && encoding === 'html') {
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }

    // URL encoding
    if (encoding === 'url') {
      sanitized = encodeURIComponent(sanitized);
    }

    // Base64 encoding
    if (encoding === 'base64') {
      sanitized = Buffer.from(sanitized).toString('base64');
    }

    return sanitized.trim();
  }

  /**
   * Validate file uploads
   */
  static validateFileUpload(file: {
    name: string;
    size: number;
    type: string;
  }, options: {
    allowedTypes?: string[];
    maxSize?: number;
    allowedExtensions?: string[];
  } = {}): { isValid: boolean; errors: string[] } {
    const {
      allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
      maxSize = 5 * 1024 * 1024, // 5MB
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
    } = options;

    const errors: string[] = [];

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} not allowed`);
    }

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size ${file.size} exceeds maximum ${maxSize} bytes`);
    }

    // Check file extension
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(extension)) {
      errors.push(`File extension ${extension} not allowed`);
    }

    // Check for double extensions (e.g., .php.jpg)
    const extensionCount = (file.name.match(/\./g) || []).length;
    if (extensionCount > 1) {
      errors.push('Multiple file extensions not allowed');
    }

    // Check for potentially dangerous filenames
    const dangerousPatterns = [
      /\.php$/i,
      /\.asp$/i,
      /\.jsp$/i,
      /\.cgi$/i,
      /\.pl$/i,
      /\.py$/i,
      /\.sh$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.exe$/i,
    ];

    if (dangerousPatterns.some(pattern => pattern.test(file.name))) {
      errors.push('Potentially dangerous file type detected');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate JSON input
   */
  static validateJsonInput(jsonString: string, schema?: z.ZodSchema): {
    isValid: boolean;
    parsed?: any;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      // Check for JSON bomb (deeply nested objects)
      const depth = this.getJsonDepth(jsonString);
      if (depth > 20) {
        errors.push('JSON structure too deeply nested');
        return { isValid: false, errors };
      }

      // Check for excessively large JSON
      if (jsonString.length > 1024 * 1024) { // 1MB
        errors.push('JSON payload too large');
        return { isValid: false, errors };
      }

      // Parse JSON
      const parsed = JSON.parse(jsonString);

      // Validate against schema if provided
      if (schema) {
        const result = schema.safeParse(parsed);
        if (!result.success) {
          errors.push(...result.error.errors.map(e => e.message));
          return { isValid: false, errors };
        }
      }

      // Check for prototype pollution
      if (this.hasPrototypePollution(parsed)) {
        errors.push('Potential prototype pollution detected');
        return { isValid: false, errors };
      }

      return { isValid: true, parsed, errors: [] };
    } catch (error) {
      errors.push('Invalid JSON format');
      return { isValid: false, errors };
    }
  }

  /**
   * Get JSON nesting depth
   */
  private static getJsonDepth(jsonString: string): number {
    let depth = 0;
    let maxDepth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{' || char === '[') {
          depth++;
          maxDepth = Math.max(maxDepth, depth);
        } else if (char === '}' || char === ']') {
          depth--;
        }
      }
    }

    return maxDepth;
  }

  /**
   * Check for prototype pollution attempts
   */
  private static hasPrototypePollution(obj: any): boolean {
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    function checkObject(current: any, visited = new Set()): boolean {
      if (visited.has(current)) return false;
      visited.add(current);

      if (typeof current !== 'object' || current === null) return false;

      for (const key in current) {
        if (dangerousKeys.includes(key)) return true;
        if (typeof current[key] === 'object' && checkObject(current[key], visited)) {
          return true;
        }
      }

      return false;
    }

    return checkObject(obj);
  }

  /**
   * Validate email with additional security checks
   */
  static validateEmail(email: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }

    // Check for suspicious patterns
    if (email.includes('..')) {
      errors.push('Email contains suspicious pattern');
    }

    // Check length limits
    const [localPart, domain] = email.split('@');
    if (localPart && localPart.length > 64) {
      errors.push('Email local part too long');
    }
    if (domain && domain.length > 253) {
      errors.push('Email domain too long');
    }

    // Check for dangerous characters
    const dangerousChars = /[<>()[\]\\;:,"]/;
    if (dangerousChars.test(email)) {
      errors.push('Email contains dangerous characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate URL with security checks
   */
  static validateUrl(url: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const parsedUrl = new URL(url);

      // Check protocol
      const allowedProtocols = ['http:', 'https:', 'ftp:', 'ftps:'];
      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        errors.push(`Protocol ${parsedUrl.protocol} not allowed`);
      }

      // Check for suspicious hostnames
      const suspiciousPatterns = [
        /localhost/i,
        /127\.0\.0\.1/,
        /0\.0\.0\.0/,
        /10\.\d+\.\d+\.\d+/,
        /192\.168\.\d+\.\d+/,
        /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
      ];

      if (suspiciousPatterns.some(pattern => pattern.test(parsedUrl.hostname))) {
        errors.push('URL points to internal/private network');
      }

      // Check for URL shorteners (potential for hiding malicious URLs)
      const shorteners = [
        'bit.ly', 'tinyurl.com', 'short.link', 't.co', 'goo.gl',
        'ow.ly', 'is.gd', 'buff.ly', 'adf.ly',
      ];

      if (shorteners.includes(parsedUrl.hostname)) {
        errors.push('URL shorteners not allowed');
      }

      // Check URL length
      if (url.length > 2048) {
        errors.push('URL too long');
      }

    } catch (error) {
      errors.push('Invalid URL format');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Enhanced input validation middleware
 */
export function enhancedInputValidation(request: NextRequest): {
  isValid: boolean;
  errors: string[];
  threats: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
} {
  const errors: string[] = [];
  const threats: string[] = [];
  let maxRiskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

  // Validate URL parameters
  const url = new URL(request.url);
  for (const [key, value] of url.searchParams.entries()) {
    const threatCheck = SecurityValidator.detectThreats(value);
    if (!threatCheck.isSecure) {
      errors.push(`Suspicious parameter: ${key}`);
      threats.push(...threatCheck.threats);
      if (getRiskPriority(threatCheck.riskLevel) > getRiskPriority(maxRiskLevel)) {
        maxRiskLevel = threatCheck.riskLevel;
      }
    }
  }

  // Validate headers
  const suspiciousHeaders = [
    'x-forwarded-host',
    'x-real-ip',
    'x-originating-ip',
    'x-forwarded-for',
  ];

  suspiciousHeaders.forEach(header => {
    const value = request.headers.get(header);
    if (value) {
      const threatCheck = SecurityValidator.detectThreats(value);
      if (!threatCheck.isSecure) {
        errors.push(`Suspicious header: ${header}`);
        threats.push(...threatCheck.threats);
        if (getRiskPriority(threatCheck.riskLevel) > getRiskPriority(maxRiskLevel)) {
          maxRiskLevel = threatCheck.riskLevel;
        }
      }
    }
  });

  // Validate User-Agent for known attack patterns
  const userAgent = request.headers.get('user-agent');
  if (userAgent) {
    const maliciousAgents = [
      /sqlmap/i,
      /nikto/i,
      /nessus/i,
      /burp/i,
      /owasp/i,
      /w3af/i,
      /skipfish/i,
      /wpscan/i,
    ];

    if (maliciousAgents.some(pattern => pattern.test(userAgent))) {
      errors.push('Malicious user agent detected');
      threats.push('MALICIOUS_AGENT');
      maxRiskLevel = 'high';
    }
  }

  return {
    isValid: errors.length === 0 && threats.length === 0,
    errors,
    threats,
    riskLevel: maxRiskLevel,
  };
}

function getRiskPriority(risk: 'low' | 'medium' | 'high' | 'critical'): number {
  const priorities = { low: 1, medium: 2, high: 3, critical: 4 };
  return priorities[risk];
}

/**
 * Create validation schema for API endpoints
 */
export function createSecureStringSchema(
  maxLength: number = 255,
  allowSpecialChars: boolean = false
) {
  return z.string()
    .min(1, 'Field cannot be empty')
    .max(maxLength, `Field too long (max ${maxLength} characters)`)
    .refine((val) => {
      const threatCheck = SecurityValidator.detectThreats(val);
      return threatCheck.isSecure || threatCheck.riskLevel === 'low';
    }, 'Input contains potentially dangerous content')
    .refine((val) => {
      if (allowSpecialChars) return true;
      return !/[<>'"&\\]/.test(val);
    }, 'Input contains restricted characters')
    .transform((val) => SecurityValidator.sanitizeInput(val));
}

/**
 * Middleware wrapper for enhanced input validation
 */
export function withEnhancedValidation<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    // Perform enhanced input validation
    const validation = enhancedInputValidation(request);

    if (!validation.isValid) {
      console.warn('Enhanced validation failed:', {
        url: request.url,
        errors: validation.errors,
        threats: validation.threats,
        riskLevel: validation.riskLevel,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
      });

      // Block critical and high-risk requests
      if (['critical', 'high'].includes(validation.riskLevel)) {
        return NextResponse.json(
          {
            error: 'Security validation failed',
            message: 'Request contains potentially dangerous content',
            code: 'SECURITY_VALIDATION_FAILED',
            riskLevel: validation.riskLevel,
          },
          { status: 403 }
        );
      }

      // Log medium and low-risk requests but allow them to proceed
      if (['medium'].includes(validation.riskLevel)) {
        console.warn('Medium risk request detected but allowed to proceed');
      }
    }

    return handler(request, ...args);
  }) as T;
}

export default SecurityValidator;