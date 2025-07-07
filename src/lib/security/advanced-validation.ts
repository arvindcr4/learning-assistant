import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Advanced input validation and sanitization for enhanced security
 */
export class AdvancedValidator {
  private readonly sqlInjectionPatterns = [
    /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|MERGE|SELECT|UPDATE|UNION|TRUNCATE)\b)/gi,
    /((\%27)|('))(\s)*(\-\-|;|\||&|\^|\+|%|\*)/gi,
    /(\b(sp_|xp_)\w+\b)/gi,
    /((\%3D)|(=))[^\n]*(\b(AND|OR|NOT)\b)[^\n]*(\%3E|\>|%3C|\<)/gi,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
  ];

  private readonly xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>/gi,
    /<link[^>]*>/gi,
    /<meta[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /<img[^>]*src\s*=\s*["']?\s*data:/gi,
  ];

  private readonly commandInjectionPatterns = [
    /[;&|`$(){}[\]\\]/g,
    /\b(cat|ls|pwd|id|whoami|uname|ps|netstat|wget|curl|nc|ncat|telnet|ssh|ftp)\b/gi,
    /(\.\.|\/\.\.|\.\.\/|\.\.\\)/g,
    /(\/etc\/passwd|\/etc\/shadow|\/etc\/hosts|\/proc\/)/gi,
  ];

  private readonly ldapInjectionPatterns = [
    /[()&|!]/g,
    /(\*|\(|\)|&|\||!)/g,
  ];

  private readonly pathTraversalPatterns = [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e%2f/gi,
    /%2e%2e%5c/gi,
    /%252e%252e%252f/gi,
  ];

  /**
   * Comprehensive input validation
   */
  validateInput(input: string, context: 'sql' | 'html' | 'url' | 'email' | 'filename' | 'json' | 'xml'): {
    isValid: boolean;
    sanitized: string;
    threats: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  } {
    const threats: string[] = [];
    let sanitized = input;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check for SQL injection
    if (this.hasSQLInjection(input)) {
      threats.push('sql_injection');
      riskLevel = 'critical';
    }

    // Check for XSS
    if (this.hasXSS(input)) {
      threats.push('xss');
      if (riskLevel !== 'critical') riskLevel = 'high';
    }

    // Check for command injection
    if (this.hasCommandInjection(input)) {
      threats.push('command_injection');
      riskLevel = 'critical';
    }

    // Check for path traversal
    if (this.hasPathTraversal(input)) {
      threats.push('path_traversal');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // Check for LDAP injection
    if (this.hasLDAPInjection(input)) {
      threats.push('ldap_injection');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // Context-specific sanitization
    sanitized = this.sanitizeByContext(input, context);

    // Additional length and character validation
    const lengthCheck = this.validateLength(sanitized, context);
    if (!lengthCheck.isValid) {
      threats.push('invalid_length');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    return {
      isValid: threats.length === 0,
      sanitized,
      threats,
      riskLevel,
    };
  }

  /**
   * Deep object validation with recursive sanitization
   */
  validateObject(obj: any, schema?: z.ZodSchema): {
    isValid: boolean;
    sanitized: any;
    threats: string[];
    errors: string[];
  } {
    const threats: string[] = [];
    const errors: string[] = [];
    let sanitized = {};

    try {
      if (schema) {
        const result = schema.safeParse(obj);
        if (!result.success) {
          errors.push(...result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
        } else {
          sanitized = result.data;
        }
      }

      // Recursive sanitization
      sanitized = this.deepSanitizeObject(obj, threats);

    } catch (error) {
      errors.push(`Object validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: threats.length === 0 && errors.length === 0,
      sanitized,
      threats,
      errors,
    };
  }

  /**
   * File upload validation
   */
  validateFileUpload(file: {
    name: string;
    size: number;
    type: string;
    content?: Buffer;
  }, options: {
    maxSize: number;
    allowedTypes: string[];
    allowedExtensions: string[];
    scanContent?: boolean;
  }): {
    isValid: boolean;
    threats: string[];
    errors: string[];
  } {
    const threats: string[] = [];
    const errors: string[] = [];

    // File size validation
    if (file.size > options.maxSize) {
      errors.push(`File size ${file.size} exceeds maximum ${options.maxSize}`);
    }

    // MIME type validation
    if (!options.allowedTypes.includes(file.type)) {
      threats.push('invalid_mime_type');
      errors.push(`MIME type ${file.type} not allowed`);
    }

    // File extension validation
    const extension = file.name.toLowerCase().split('.').pop() || '';
    if (!options.allowedExtensions.includes(extension)) {
      threats.push('invalid_extension');
      errors.push(`File extension .${extension} not allowed`);
    }

    // Filename validation
    const filenameValidation = this.validateInput(file.name, 'filename');
    if (!filenameValidation.isValid) {
      threats.push(...filenameValidation.threats);
      errors.push('Malicious filename detected');
    }

    // Content scanning (if enabled and content provided)
    if (options.scanContent && file.content) {
      const contentThreats = this.scanFileContent(file.content, file.type);
      threats.push(...contentThreats);
    }

    return {
      isValid: threats.length === 0 && errors.length === 0,
      threats,
      errors,
    };
  }

  /**
   * URL validation with security checks
   */
  validateURL(url: string, options: {
    allowedSchemes?: string[];
    allowedDomains?: string[];
    blockPrivateIPs?: boolean;
  } = {}): {
    isValid: boolean;
    threats: string[];
    normalizedURL: string;
  } {
    const threats: string[] = [];
    let normalizedURL = url;

    try {
      const parsedURL = new URL(url);
      
      // Scheme validation
      const allowedSchemes = options.allowedSchemes || ['http', 'https'];
      if (!allowedSchemes.includes(parsedURL.protocol.slice(0, -1))) {
        threats.push('invalid_scheme');
      }

      // Domain validation
      if (options.allowedDomains && !options.allowedDomains.includes(parsedURL.hostname)) {
        threats.push('domain_not_allowed');
      }

      // Private IP detection
      if (options.blockPrivateIPs && this.isPrivateIP(parsedURL.hostname)) {
        threats.push('private_ip_access');
      }

      // URL encoding attacks
      if (this.hasURLEncodingAttack(url)) {
        threats.push('url_encoding_attack');
      }

      normalizedURL = parsedURL.toString();

    } catch (error) {
      threats.push('invalid_url_format');
    }

    return {
      isValid: threats.length === 0,
      threats,
      normalizedURL,
    };
  }

  /**
   * Database query parameter validation
   */
  validateDatabaseParams(params: Record<string, any>): {
    isValid: boolean;
    sanitized: Record<string, any>;
    threats: string[];
  } {
    const threats: string[] = [];
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      // Key validation
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
        threats.push('invalid_parameter_key');
        continue;
      }

      // Value validation
      if (typeof value === 'string') {
        const validation = this.validateInput(value, 'sql');
        if (!validation.isValid) {
          threats.push(...validation.threats);
        }
        sanitized[key] = validation.sanitized;
      } else if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          threats.push('invalid_number');
        } else {
          sanitized[key] = value;
        }
      } else if (typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (value === null) {
        sanitized[key] = null;
      } else {
        threats.push('unsupported_parameter_type');
      }
    }

    return {
      isValid: threats.length === 0,
      sanitized,
      threats,
    };
  }

  // Private helper methods

  private hasSQLInjection(input: string): boolean {
    return this.sqlInjectionPatterns.some(pattern => pattern.test(input));
  }

  private hasXSS(input: string): boolean {
    return this.xssPatterns.some(pattern => pattern.test(input));
  }

  private hasCommandInjection(input: string): boolean {
    return this.commandInjectionPatterns.some(pattern => pattern.test(input));
  }

  private hasLDAPInjection(input: string): boolean {
    return this.ldapInjectionPatterns.some(pattern => pattern.test(input));
  }

  private hasPathTraversal(input: string): boolean {
    return this.pathTraversalPatterns.some(pattern => pattern.test(input));
  }

  private hasURLEncodingAttack(url: string): boolean {
    // Check for multiple encoding attempts
    const decoded1 = decodeURIComponent(url);
    const decoded2 = decodeURIComponent(decoded1);
    return decoded1 !== decoded2;
  }

  private isPrivateIP(hostname: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/,
    ];

    return privateRanges.some(range => range.test(hostname));
  }

  private sanitizeByContext(input: string, context: string): string {
    switch (context) {
      case 'html':
        return DOMPurify.sanitize(input);
      
      case 'sql':
        // Escape SQL special characters
        return input.replace(/'/g, "''").replace(/;/g, '\\;');
      
      case 'url':
        return encodeURIComponent(input);
      
      case 'filename':
        return input.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      
      case 'json':
        return input.replace(/[<>&"']/g, (match) => {
          const escapes: Record<string, string> = {
            '<': '\\u003c',
            '>': '\\u003e',
            '&': '\\u0026',
            '"': '\\"',
            "'": "\\'",
          };
          return escapes[match] || match;
        });
      
      default:
        return input.replace(/[<>&"']/g, (match) => {
          const entities: Record<string, string> = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#x27;',
          };
          return entities[match] || match;
        });
    }
  }

  private validateLength(input: string, context: string): { isValid: boolean } {
    const limits: Record<string, number> = {
      email: 254,
      url: 2048,
      filename: 255,
      html: 1000000, // 1MB
      sql: 4000,
      json: 1000000, // 1MB
      xml: 1000000, // 1MB
    };

    const limit = limits[context] || 1000;
    return { isValid: input.length <= limit };
  }

  private deepSanitizeObject(obj: any, threats: string[]): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      const validation = this.validateInput(obj, 'html');
      if (!validation.isValid) {
        threats.push(...validation.threats);
      }
      return validation.sanitized;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSanitizeObject(item, threats));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeByContext(key, 'html');
        sanitized[sanitizedKey] = this.deepSanitizeObject(value, threats);
      }
      return sanitized;
    }

    return obj;
  }

  private scanFileContent(content: Buffer, mimeType: string): string[] {
    const threats: string[] = [];

    // Check for executable signatures
    const executableSignatures = [
      { signature: Buffer.from([0x4D, 0x5A]), type: 'executable' }, // MZ (PE)
      { signature: Buffer.from([0x7F, 0x45, 0x4C, 0x46]), type: 'elf' }, // ELF
      { signature: Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), type: 'java' }, // Java class
      { signature: Buffer.from([0x50, 0x4B, 0x03, 0x04]), type: 'zip' }, // ZIP/JAR
    ];

    for (const { signature, type } of executableSignatures) {
      if (content.subarray(0, signature.length).equals(signature)) {
        threats.push(`executable_content_${type}`);
      }
    }

    // Check for embedded scripts in images
    if (mimeType.startsWith('image/')) {
      const contentStr = content.toString('utf8');
      if (this.hasXSS(contentStr)) {
        threats.push('embedded_script_in_image');
      }
    }

    // Check for PHP/ASP content in uploads
    const webShellPatterns = [
      /<\?php/i,
      /<\%/i,
      /eval\(/i,
      /exec\(/i,
      /system\(/i,
      /shell_exec\(/i,
    ];

    const contentStr = content.toString('utf8');
    for (const pattern of webShellPatterns) {
      if (pattern.test(contentStr)) {
        threats.push('web_shell_content');
        break;
      }
    }

    return threats;
  }
}

// Export singleton instance
export const advancedValidator = new AdvancedValidator();