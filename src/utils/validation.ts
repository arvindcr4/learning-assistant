// Input validation utilities for API endpoints
import { NextResponse } from 'next/server';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: any;
}

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'uuid';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => string | null;
}

export class ApiValidator {
  private rules: ValidationRule[] = [];

  constructor(rules: ValidationRule[]) {
    this.rules = rules;
  }

  validate(data: any): ValidationResult {
    const errors: string[] = [];
    const validatedData: any = {};

    for (const rule of this.rules) {
      const value = data[rule.field];
      const fieldErrors = this.validateField(rule, value);
      
      if (fieldErrors.length > 0) {
        errors.push(...fieldErrors);
      } else if (value !== undefined) {
        validatedData[rule.field] = this.coerceType(value, rule.type);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: validatedData
    };
  }

  private validateField(rule: ValidationRule, value: any): string[] {
    const errors: string[] = [];
    const fieldName = rule.field;

    // Check required
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${fieldName} is required`);
      return errors;
    }

    // If value is undefined/null and not required, skip other validations
    if (value === undefined || value === null) {
      return errors;
    }

    // Type validation
    if (rule.type) {
      const typeError = this.validateType(fieldName, value, rule.type);
      if (typeError) {
        errors.push(typeError);
        return errors; // Don't continue if type is wrong
      }
    }

    // Length validation for strings
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${fieldName} must be at least ${rule.minLength} characters long`);
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${fieldName} must be no more than ${rule.maxLength} characters long`);
      }
    }

    // Numeric validation
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`${fieldName} must be at least ${rule.min}`);
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`${fieldName} must be no more than ${rule.max}`);
      }
    }

    // Array validation
    if (Array.isArray(value)) {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        errors.push(`${fieldName} must contain at least ${rule.minLength} items`);
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors.push(`${fieldName} must contain no more than ${rule.maxLength} items`);
      }
    }

    // Pattern validation
    if (rule.pattern && typeof value === 'string') {
      if (!rule.pattern.test(value)) {
        errors.push(`${fieldName} format is invalid`);
      }
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`${fieldName} must be one of: ${rule.enum.join(', ')}`);
    }

    // Custom validation
    if (rule.custom) {
      const customError = rule.custom(value);
      if (customError) {
        errors.push(customError);
      }
    }

    return errors;
  }

  private validateType(fieldName: string, value: any, type: string): string | null {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          return `${fieldName} must be a string`;
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return `${fieldName} must be a number`;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return `${fieldName} must be a boolean`;
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return `${fieldName} must be an array`;
        }
        break;
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          return `${fieldName} must be an object`;
        }
        break;
      case 'email':
        if (typeof value !== 'string' || !this.isValidEmail(value)) {
          return `${fieldName} must be a valid email address`;
        }
        break;
      case 'uuid':
        if (typeof value !== 'string' || !this.isValidUUID(value)) {
          return `${fieldName} must be a valid UUID`;
        }
        break;
    }
    return null;
  }

  private coerceType(value: any, type?: string): any {
    if (!type) return value;
    
    switch (type) {
      case 'number':
        return typeof value === 'string' ? parseFloat(value) : value;
      case 'boolean':
        return typeof value === 'string' ? value.toLowerCase() === 'true' : value;
      default:
        return value;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}

// Common validation rule sets
export const UserValidationRules = {
  profile: [
    { field: 'userId', required: true, type: 'uuid' as const },
    { field: 'name', required: false, type: 'string' as const, minLength: 2, maxLength: 100 },
    { field: 'email', required: false, type: 'email' as const },
    { field: 'preferences', required: false, type: 'object' as const }
  ],
  
  varkResponse: [
    { field: 'userId', required: true, type: 'uuid' as const },
    { field: 'responses', required: true, type: 'object' as const },
    { 
      field: 'responses', 
      custom: (value: any) => {
        if (!value || typeof value !== 'object') return null;
        const keys = Object.keys(value);
        if (keys.length === 0) return 'At least one response is required';
        for (const key of keys) {
          if (!/^q\d+$/.test(key)) return 'Invalid question ID format';
          if (typeof value[key] !== 'string') return 'Response values must be strings';
        }
        return null;
      }
    }
  ]
};

export const SessionValidationRules = {
  create: [
    { field: 'userId', required: true, type: 'uuid' as const },
    { field: 'contentId', required: true, type: 'string' as const },
    { field: 'sessionData', required: true, type: 'object' as const },
    { field: 'sessionData.startTime', required: true, type: 'string' as const },
    { field: 'sessionData.duration', required: false, type: 'number' as const, min: 0 },
    { field: 'sessionData.itemsCompleted', required: false, type: 'number' as const, min: 0 },
    { field: 'sessionData.correctAnswers', required: false, type: 'number' as const, min: 0 },
    { field: 'sessionData.totalQuestions', required: false, type: 'number' as const, min: 0 },
    { field: 'sessionData.completed', required: false, type: 'boolean' as const }
  ],
  
  query: [
    { field: 'userId', required: true, type: 'uuid' as const },
    { field: 'limit', required: false, type: 'number' as const, min: 1, max: 100 },
    { field: 'offset', required: false, type: 'number' as const, min: 0 }
  ]
};

export const ContentValidationRules = {
  adapt: [
    { field: 'userId', required: true, type: 'uuid' as const },
    { field: 'contentId', required: true, type: 'string' as const },
    { field: 'content', required: true, type: 'object' as const },
    { field: 'content.title', required: true, type: 'string' as const, minLength: 1, maxLength: 200 },
    { field: 'content.description', required: false, type: 'string' as const, maxLength: 1000 },
    { field: 'content.difficulty', required: false, type: 'number' as const, min: 1, max: 10 }
  ]
};

export const AssessmentValidationRules = {
  create: [
    { field: 'title', required: true, type: 'string' as const, minLength: 1, maxLength: 200 },
    { field: 'description', required: false, type: 'string' as const, maxLength: 1000 },
    { field: 'questions', required: true, type: 'array' as const, minLength: 1 },
    { field: 'timeLimit', required: false, type: 'number' as const, min: 1 },
    { field: 'passingScore', required: false, type: 'number' as const, min: 0, max: 100 }
  ],
  
  submit: [
    { field: 'userId', required: true, type: 'uuid' as const },
    { field: 'assessmentId', required: true, type: 'string' as const },
    { field: 'answers', required: true, type: 'object' as const },
    { field: 'timeSpent', required: false, type: 'number' as const, min: 0 }
  ]
};

export const AnalyticsValidationRules = {
  query: [
    { field: 'userId', required: true, type: 'uuid' as const },
    { field: 'timeRange', required: false, type: 'number' as const, min: 1, max: 365 },
    { field: 'metrics', required: false, type: 'array' as const }
  ],
  
  track: [
    { field: 'userId', required: true, type: 'uuid' as const },
    { field: 'interaction', required: true, type: 'object' as const },
    { field: 'interaction.action', required: true, type: 'string' as const },
    { field: 'interaction.contentType', required: true, type: 'string' as const },
    { field: 'interaction.duration', required: false, type: 'number' as const, min: 0 },
    { field: 'interaction.engagementLevel', required: false, type: 'number' as const, min: 0, max: 100 }
  ]
};

// Helper function to validate and return error response
export function validateRequest(
  data: any,
  rules: ValidationRule[]
): { isValid: boolean; response?: NextResponse; validatedData?: any } {
  const validator = new ApiValidator(rules);
  const result = validator.validate(data);
  
  if (!result.isValid) {
    return {
      isValid: false,
      response: NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Please check your input data',
          details: result.errors
        },
        { status: 400 }
      )
    };
  }
  
  return {
    isValid: true,
    validatedData: result.data
  };
}

// Query parameter validation
export function validateQueryParams(
  searchParams: URLSearchParams,
  rules: ValidationRule[]
): { isValid: boolean; response?: NextResponse; validatedData?: any } {
  const data: any = {};
  
  // Convert URLSearchParams to object
  for (const [key, value] of searchParams.entries()) {
    data[key] = value;
  }
  
  return validateRequest(data, rules);
}