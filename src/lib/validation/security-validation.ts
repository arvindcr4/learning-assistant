import { z } from 'zod';
import { NextRequest } from 'next/server';
import DOMPurify from 'isomorphic-dompurify';

// Security validation configuration
interface SecurityValidationConfig {
  enableXSSProtection: boolean;
  enableSQLInjectionProtection: boolean;
  enablePathTraversalProtection: boolean;
  enableNoSQLInjectionProtection: boolean;
  maxStringLength: number;
  maxArrayLength: number;
  maxObjectDepth: number;
  allowedImageTypes: string[];
  allowedFileTypes: string[];
  maxFileSize: number;
}

const defaultConfig: SecurityValidationConfig = {
  enableXSSProtection: true,
  enableSQLInjectionProtection: true,
  enablePathTraversalProtection: true,
  enableNoSQLInjectionProtection: true,
  maxStringLength: 10000,
  maxArrayLength: 1000,
  maxObjectDepth: 10,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedFileTypes: ['application/pdf', 'text/plain', 'application/json'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

// Security threat patterns
const SECURITY_PATTERNS = {
  XSS: [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi,
  ],
  
  SQL_INJECTION: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /('|(\\')|(;)|(\\;)|(\|)|(\\\|))/gi,
    /(\b(CONCAT|CHAR|SUBSTRING|ASCII|HEX)\s*\()/gi,
    /(\b(SLEEP|BENCHMARK|WAITFOR)\s*\()/gi,
  ],
  
  NOSQL_INJECTION: [
    /\$where/gi,
    /\$ne/gi,
    /\$nin/gi,
    /\$in/gi,
    /\$gt/gi,
    /\$lt/gi,
    /\$regex/gi,
    /\$exists/gi,
    /\$type/gi,
    /\$mod/gi,
    /\$all/gi,
    /\$size/gi,
    /\$elemMatch/gi,
  ],
  
  PATH_TRAVERSAL: [
    /\.\./gi,
    /\.\\\./gi,
    /\%2e\%2e/gi,
    /\%2e\%2e\%2f/gi,
    /\%2e\%2e\%5c/gi,
    /\%252e\%252e/gi,
    /\%c0\%ae/gi,
    /\%c1\%9c/gi,
  ],
  
  COMMAND_INJECTION: [
    /(\||;|&|`|\$\(|\${)/gi,
    /(\b(cat|ls|pwd|whoami|id|uname|netstat|ps|kill|rm|cp|mv|chmod|chown|su|sudo|crontab|service|systemctl)\b)/gi,
    /(\b(nc|ncat|telnet|ssh|ftp|wget|curl|ping|nslookup|dig|traceroute)\b)/gi,
  ],
  
  LDAP_INJECTION: [
    /(\*|\(|\)|\\|\/|\||&)/gi,
    /(\b(objectclass|cn|uid|mail|sn|givenname)\b)/gi,
  ],
  
  HEADER_INJECTION: [
    /(\r\n|\r|\n)/gi,
    /(\%0d\%0a|\%0d|\%0a)/gi,
    /(\%0D\%0A|\%0D|\%0A)/gi,
  ],
};

// Validation result interface
interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: any;
  errors: string[];
  warnings: string[];
  threats: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Security validation class
export class SecurityValidator {
  private config: SecurityValidationConfig;
  
  constructor(config: Partial<SecurityValidationConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }
  
  /**
   * Validate and sanitize input data
   */
  validateInput(data: any, type: 'string' | 'object' | 'array' | 'file' = 'string'): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      threats: [],
      riskLevel: 'low',
    };
    
    try {
      switch (type) {
        case 'string':
          return this.validateString(data);
        case 'object':
          return this.validateObject(data);
        case 'array':
          return this.validateArray(data);
        case 'file':
          return this.validateFile(data);
        default:
          result.errors.push('Invalid validation type');
          result.isValid = false;
          return result;
      }
    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
      result.riskLevel = 'critical';
      return result;
    }
  }
  
  /**
   * Validate string input
   */
  private validateString(input: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: input,
      errors: [],
      warnings: [],
      threats: [],
      riskLevel: 'low',
    };
    
    if (typeof input !== 'string') {
      result.errors.push('Input must be a string');
      result.isValid = false;
      return result;
    }
    
    // Length validation
    if (input.length > this.config.maxStringLength) {
      result.errors.push(`String length exceeds maximum (${this.config.maxStringLength})`);
      result.isValid = false;
      result.riskLevel = 'medium';
    }
    
    // Threat detection
    this.detectThreats(input, result);
    
    // Sanitization
    if (result.isValid) {
      result.sanitizedValue = this.sanitizeString(input);
    }
    
    return result;
  }
  
  /**
   * Validate object input
   */
  private validateObject(input: any, depth: number = 0): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: {},
      errors: [],
      warnings: [],
      threats: [],
      riskLevel: 'low',
    };
    
    if (typeof input !== 'object' || input === null) {
      result.errors.push('Input must be an object');
      result.isValid = false;
      return result;
    }
    
    // Depth validation
    if (depth > this.config.maxObjectDepth) {
      result.errors.push(`Object depth exceeds maximum (${this.config.maxObjectDepth})`);
      result.isValid = false;
      result.riskLevel = 'high';
      return result;
    }
    
    // Validate each property
    for (const [key, value] of Object.entries(input)) {
      // Validate key
      const keyValidation = this.validateString(key);
      if (!keyValidation.isValid) {
        result.errors.push(`Invalid key "${key}": ${keyValidation.errors.join(', ')}`);
        result.isValid = false;
        result.riskLevel = this.escalateRiskLevel(result.riskLevel, keyValidation.riskLevel);
        continue;
      }
      
      // Validate value
      let valueValidation: ValidationResult;
      if (typeof value === 'string') {
        valueValidation = this.validateString(value);
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          valueValidation = this.validateArray(value);
        } else {
          valueValidation = this.validateObject(value, depth + 1);
        }
      } else {
        valueValidation = {
          isValid: true,
          sanitizedValue: value,
          errors: [],
          warnings: [],
          threats: [],
          riskLevel: 'low',
        };
      }
      
      if (!valueValidation.isValid) {
        result.errors.push(`Invalid value for "${key}": ${valueValidation.errors.join(', ')}`);
        result.isValid = false;
      }
      
      // Merge threats and warnings
      result.threats.push(...valueValidation.threats);
      result.warnings.push(...valueValidation.warnings);
      result.riskLevel = this.escalateRiskLevel(result.riskLevel, valueValidation.riskLevel);
      
      // Set sanitized value
      if (result.isValid) {
        result.sanitizedValue[keyValidation.sanitizedValue] = valueValidation.sanitizedValue;
      }
    }
    
    return result;
  }
  
  /**
   * Validate array input
   */
  private validateArray(input: any[]): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: [],
      errors: [],
      warnings: [],
      threats: [],
      riskLevel: 'low',
    };
    
    if (!Array.isArray(input)) {
      result.errors.push('Input must be an array');
      result.isValid = false;
      return result;
    }
    
    // Length validation
    if (input.length > this.config.maxArrayLength) {
      result.errors.push(`Array length exceeds maximum (${this.config.maxArrayLength})`);
      result.isValid = false;
      result.riskLevel = 'medium';
      return result;
    }
    
    // Validate each element
    for (let i = 0; i < input.length; i++) {
      const element = input[i];
      let elementValidation: ValidationResult;
      
      if (typeof element === 'string') {
        elementValidation = this.validateString(element);
      } else if (typeof element === 'object' && element !== null) {
        if (Array.isArray(element)) {
          elementValidation = this.validateArray(element);
        } else {
          elementValidation = this.validateObject(element);
        }
      } else {
        elementValidation = {
          isValid: true,
          sanitizedValue: element,
          errors: [],
          warnings: [],
          threats: [],
          riskLevel: 'low',
        };
      }
      
      if (!elementValidation.isValid) {
        result.errors.push(`Invalid element at index ${i}: ${elementValidation.errors.join(', ')}`);
        result.isValid = false;
      }
      
      // Merge threats and warnings
      result.threats.push(...elementValidation.threats);
      result.warnings.push(...elementValidation.warnings);
      result.riskLevel = this.escalateRiskLevel(result.riskLevel, elementValidation.riskLevel);
      
      // Set sanitized value
      if (result.isValid) {
        result.sanitizedValue.push(elementValidation.sanitizedValue);
      }
    }
    
    return result;
  }
  
  /**
   * Validate file input
   */
  private validateFile(file: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: file,
      errors: [],
      warnings: [],
      threats: [],
      riskLevel: 'low',
    };
    
    if (!file || typeof file !== 'object') {
      result.errors.push('Invalid file object');
      result.isValid = false;
      return result;
    }
    
    // File type validation
    if (file.type && !this.isAllowedFileType(file.type)) {
      result.errors.push(`File type not allowed: ${file.type}`);
      result.isValid = false;
      result.riskLevel = 'high';
    }
    
    // File size validation
    if (file.size && file.size > this.config.maxFileSize) {
      result.errors.push(`File size exceeds maximum (${this.config.maxFileSize} bytes)`);
      result.isValid = false;
      result.riskLevel = 'medium';
    }
    
    // File name validation
    if (file.name) {
      const nameValidation = this.validateString(file.name);
      if (!nameValidation.isValid) {
        result.errors.push(`Invalid file name: ${nameValidation.errors.join(', ')}`);
        result.isValid = false;
        result.riskLevel = this.escalateRiskLevel(result.riskLevel, nameValidation.riskLevel);
      }
    }
    
    return result;
  }
  
  /**
   * Detect security threats in input
   */
  private detectThreats(input: string, result: ValidationResult): void {
    // XSS detection
    if (this.config.enableXSSProtection) {
      for (const pattern of SECURITY_PATTERNS.XSS) {
        if (pattern.test(input)) {
          result.threats.push('XSS attempt detected');
          result.riskLevel = 'critical';
          result.isValid = false;
          break;
        }
      }
    }
    
    // SQL injection detection
    if (this.config.enableSQLInjectionProtection) {
      for (const pattern of SECURITY_PATTERNS.SQL_INJECTION) {
        if (pattern.test(input)) {
          result.threats.push('SQL injection attempt detected');
          result.riskLevel = 'critical';
          result.isValid = false;
          break;
        }
      }
    }
    
    // NoSQL injection detection
    if (this.config.enableNoSQLInjectionProtection) {
      for (const pattern of SECURITY_PATTERNS.NOSQL_INJECTION) {
        if (pattern.test(input)) {
          result.threats.push('NoSQL injection attempt detected');
          result.riskLevel = 'high';
          result.warnings.push('Potential NoSQL injection pattern found');
          break;
        }
      }
    }
    
    // Path traversal detection
    if (this.config.enablePathTraversalProtection) {
      for (const pattern of SECURITY_PATTERNS.PATH_TRAVERSAL) {
        if (pattern.test(input)) {
          result.threats.push('Path traversal attempt detected');
          result.riskLevel = 'high';
          result.isValid = false;
          break;
        }
      }
    }
    
    // Command injection detection
    for (const pattern of SECURITY_PATTERNS.COMMAND_INJECTION) {
      if (pattern.test(input)) {
        result.threats.push('Command injection attempt detected');
        result.riskLevel = 'critical';
        result.isValid = false;
        break;
      }
    }
    
    // LDAP injection detection
    for (const pattern of SECURITY_PATTERNS.LDAP_INJECTION) {
      if (pattern.test(input)) {
        result.threats.push('LDAP injection attempt detected');
        result.riskLevel = 'high';
        result.warnings.push('Potential LDAP injection pattern found');
        break;
      }
    }
    
    // Header injection detection
    for (const pattern of SECURITY_PATTERNS.HEADER_INJECTION) {
      if (pattern.test(input)) {
        result.threats.push('Header injection attempt detected');
        result.riskLevel = 'high';
        result.isValid = false;
        break;
      }
    }
  }
  
  /**
   * Sanitize string input
   */
  private sanitizeString(input: string): string {
    let sanitized = input;
    
    // HTML sanitization
    if (this.config.enableXSSProtection) {
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
      });
    }
    
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    return sanitized;
  }
  
  /**
   * Check if file type is allowed
   */
  private isAllowedFileType(fileType: string): boolean {
    return [...this.config.allowedImageTypes, ...this.config.allowedFileTypes].includes(fileType);
  }
  
  /**
   * Escalate risk level
   */
  private escalateRiskLevel(
    current: 'low' | 'medium' | 'high' | 'critical',
    new_level: 'low' | 'medium' | 'high' | 'critical'
  ): 'low' | 'medium' | 'high' | 'critical' {
    const levels = ['low', 'medium', 'high', 'critical'];
    const currentIndex = levels.indexOf(current);
    const newIndex = levels.indexOf(new_level);
    return levels[Math.max(currentIndex, newIndex)] as 'low' | 'medium' | 'high' | 'critical';
  }
  
  /**
   * Validate request headers
   */
  validateHeaders(request: NextRequest): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: {},
      errors: [],
      warnings: [],
      threats: [],
      riskLevel: 'low',
    };
    
    // Validate critical headers
    const criticalHeaders = ['authorization', 'content-type', 'user-agent', 'referer', 'origin'];
    
    for (const headerName of criticalHeaders) {
      const headerValue = request.headers.get(headerName);
      if (headerValue) {
        const headerValidation = this.validateString(headerValue);
        if (!headerValidation.isValid) {
          result.errors.push(`Invalid header "${headerName}": ${headerValidation.errors.join(', ')}`);
          result.isValid = false;
          result.riskLevel = this.escalateRiskLevel(result.riskLevel, headerValidation.riskLevel);
        }
        result.threats.push(...headerValidation.threats);
        result.warnings.push(...headerValidation.warnings);
      }
    }
    
    // Check for suspicious headers
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-cluster-client-ip'];
    for (const headerName of suspiciousHeaders) {
      const headerValue = request.headers.get(headerName);
      if (headerValue) {
        // Validate IP addresses
        const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipPattern.test(headerValue.split(',')[0].trim())) {
          result.warnings.push(`Suspicious IP header "${headerName}": ${headerValue}`);
          result.riskLevel = this.escalateRiskLevel(result.riskLevel, 'medium');
        }
      }
    }
    
    return result;
  }
  
  /**
   * Validate request body size
   */
  validateBodySize(contentLength: number): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      threats: [],
      riskLevel: 'low',
    };
    
    const maxBodySize = 50 * 1024 * 1024; // 50MB
    if (contentLength > maxBodySize) {
      result.errors.push(`Request body size exceeds maximum (${maxBodySize} bytes)`);
      result.isValid = false;
      result.riskLevel = 'high';
    }
    
    return result;
  }
}

// Create enhanced Zod schemas with security validation
export const createSecureStringSchema = (
  maxLength: number = 1000,
  config: Partial<SecurityValidationConfig> = {}
) => {
  const validator = new SecurityValidator(config);
  
  return z.string()
    .max(maxLength, `String must be at most ${maxLength} characters`)
    .refine((value) => {
      const validation = validator.validateInput(value, 'string');
      return validation.isValid;
    }, {
      message: 'String contains invalid or potentially dangerous content',
    })
    .transform((value) => {
      const validation = validator.validateInput(value, 'string');
      return validation.sanitizedValue || value;
    });
};

export const createSecureObjectSchema = (
  schema: z.ZodObject<any>,
  config: Partial<SecurityValidationConfig> = {}
) => {
  const validator = new SecurityValidator(config);
  
  return schema.refine((value) => {
    const validation = validator.validateInput(value, 'object');
    return validation.isValid;
  }, {
    message: 'Object contains invalid or potentially dangerous content',
  });
};

export const createSecureArraySchema = (
  itemSchema: z.ZodType<any>,
  maxLength: number = 100,
  config: Partial<SecurityValidationConfig> = {}
) => {
  const validator = new SecurityValidator(config);
  
  return z.array(itemSchema)
    .max(maxLength, `Array must contain at most ${maxLength} items`)
    .refine((value) => {
      const validation = validator.validateInput(value, 'array');
      return validation.isValid;
    }, {
      message: 'Array contains invalid or potentially dangerous content',
    });
};

// Export default validator instance
export const defaultSecurityValidator = new SecurityValidator();

// Export validation middleware
export const validateSecurityMiddleware = (
  data: any,
  type: 'string' | 'object' | 'array' | 'file' = 'object'
): ValidationResult => {
  return defaultSecurityValidator.validateInput(data, type);
};