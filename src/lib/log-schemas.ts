import { z } from 'zod';

// Base log entry schema
export const BaseLogSchema = z.object({
  timestamp: z.string().datetime(),
  level: z.enum(['error', 'warn', 'info', 'debug', 'http']),
  message: z.string().min(1),
  service: z.string().default('learning-assistant'),
  environment: z.string().optional(),
  version: z.string().optional(),
  hostname: z.string().optional(),
  pid: z.number().optional(),
});

// Correlation context schema
export const CorrelationSchema = z.object({
  correlationId: z.string().uuid().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  parentSpanId: z.string().optional(),
  requestId: z.string().uuid().optional(),
});

// User context schema
export const UserContextSchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  userAgent: z.string().optional(),
  ip: z.string().ip().optional(),
});

// HTTP request/response schema
export const HttpLogSchema = BaseLogSchema.extend({
  category: z.literal('http'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
  url: z.string().url().optional(),
  path: z.string(),
  query: z.string().optional(),
  statusCode: z.number().int().min(100).max(599).optional(),
  duration: z.number().positive().optional(),
  responseTime: z.string().optional(),
  contentLength: z.string().optional(),
  contentType: z.string().optional(),
  referer: z.string().optional(),
  slowRequest: z.boolean().optional(),
  threshold: z.number().optional(),
}).merge(CorrelationSchema).merge(UserContextSchema);

// Error log schema
export const ErrorLogSchema = BaseLogSchema.extend({
  category: z.literal('error'),
  error: z.object({
    name: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    code: z.string().optional(),
  }).optional(),
  context: z.string().optional(),
}).merge(CorrelationSchema);

// Performance log schema
export const PerformanceLogSchema = BaseLogSchema.extend({
  category: z.literal('performance'),
  operation: z.string(),
  duration: z.number().positive(),
  responseTime: z.string(),
  slowOperation: z.boolean().optional(),
  threshold: z.number().optional(),
  metadata: z.record(z.any()).optional(),
}).merge(CorrelationSchema);

// Database operation schema
export const DatabaseLogSchema = BaseLogSchema.extend({
  category: z.literal('database'),
  operation: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER']),
  table: z.string(),
  query: z.string().optional(),
  duration: z.number().positive(),
  rowsAffected: z.number().int().optional(),
  slowQuery: z.boolean().optional(),
  threshold: z.number().optional(),
}).merge(CorrelationSchema);

// Security/audit log schema
export const SecurityLogSchema = BaseLogSchema.extend({
  category: z.literal('security'),
  eventType: z.enum([
    'authentication',
    'authorization',
    'data_access',
    'data_modification',
    'security_violation',
    'admin_action',
    'api_access',
    'privacy_event',
    'compliance_event',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  action: z.string(),
  resource: z.string().optional(),
  outcome: z.enum(['success', 'failure', 'error']),
  riskScore: z.number().min(0).max(100).optional(),
  complianceFlags: z.array(z.string()).optional(),
  sensitive: z.boolean().optional(),
  securityEvent: z.boolean().optional(),
}).merge(CorrelationSchema).merge(UserContextSchema);

// Business event schema
export const BusinessLogSchema = BaseLogSchema.extend({
  category: z.literal('business'),
  event: z.string(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string(),
  businessEvent: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
}).merge(CorrelationSchema).merge(UserContextSchema);

// System metrics schema
export const SystemLogSchema = BaseLogSchema.extend({
  category: z.literal('system'),
  metric: z.string(),
  value: z.number(),
  unit: z.string(),
  memory: z.object({
    rss: z.string(),
    heapTotal: z.string(),
    heapUsed: z.string(),
    external: z.string(),
  }).optional(),
  uptime: z.string().optional(),
  platform: z.string().optional(),
  nodeVersion: z.string().optional(),
});

// External API call schema
export const ExternalApiLogSchema = BaseLogSchema.extend({
  category: z.literal('external-api'),
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
  statusCode: z.number().int().min(100).max(599),
  duration: z.number().positive(),
  responseTime: z.string(),
  slowApiCall: z.boolean().optional(),
  threshold: z.number().optional(),
  provider: z.string().optional(),
}).merge(CorrelationSchema);

// Sampling metadata schema
export const SamplingSchema = z.object({
  sampled: z.boolean(),
  sampleRate: z.number().min(0).max(1),
});

// Union of all log schemas
export const LogEntrySchema = z.discriminatedUnion('category', [
  HttpLogSchema,
  ErrorLogSchema,
  PerformanceLogSchema,
  DatabaseLogSchema,
  SecurityLogSchema,
  BusinessLogSchema,
  SystemLogSchema,
  ExternalApiLogSchema,
  BaseLogSchema.extend({ category: z.string() }), // Fallback for unknown categories
]);

// Log validation utilities
export class LogValidator {
  private static instance: LogValidator;
  private validationErrors: Array<{
    timestamp: string;
    error: string;
    logEntry: any;
  }> = [];
  
  private constructor() {}
  
  static getInstance(): LogValidator {
    if (!LogValidator.instance) {
      LogValidator.instance = new LogValidator();
    }
    return LogValidator.instance;
  }
  
  // Validate a log entry
  validate(logEntry: any): {
    isValid: boolean;
    errors?: z.ZodError;
    sanitized?: any;
  } {
    try {
      const sanitized = this.sanitizeLogEntry(logEntry);
      const validated = LogEntrySchema.parse(sanitized);
      return { isValid: true, sanitized: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.recordValidationError(error.message, logEntry);
        return { isValid: false, errors: error };
      }
      
      this.recordValidationError('Unknown validation error', logEntry);
      return { isValid: false };
    }
  }
  
  // Sanitize log entry before validation
  private sanitizeLogEntry(logEntry: any): any {
    const sanitized = { ...logEntry };
    
    // Ensure timestamp is present
    if (!sanitized.timestamp) {
      sanitized.timestamp = new Date().toISOString();
    }
    
    // Ensure service is present
    if (!sanitized.service) {
      sanitized.service = 'learning-assistant';
    }
    
    // Sanitize sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
      if (sanitized.headers && sanitized.headers[field]) {
        sanitized.headers[field] = '[REDACTED]';
      }
    }
    
    // Truncate long strings
    if (sanitized.message && sanitized.message.length > 1000) {
      sanitized.message = sanitized.message.substring(0, 1000) + '...';
    }
    
    if (sanitized.query && sanitized.query.length > 500) {
      sanitized.query = sanitized.query.substring(0, 500) + '...';
    }
    
    return sanitized;
  }
  
  // Record validation error
  private recordValidationError(error: string, logEntry: any): void {
    this.validationErrors.push({
      timestamp: new Date().toISOString(),
      error,
      logEntry: JSON.stringify(logEntry).substring(0, 500),
    });
    
    // Keep only last 100 validation errors
    if (this.validationErrors.length > 100) {
      this.validationErrors = this.validationErrors.slice(-100);
    }
  }
  
  // Get validation errors
  getValidationErrors(): Array<{
    timestamp: string;
    error: string;
    logEntry: string;
  }> {
    return [...this.validationErrors];
  }
  
  // Clear validation errors
  clearValidationErrors(): void {
    this.validationErrors = [];
  }
  
  // Validate specific log category
  validateCategory(category: string, logEntry: any): {
    isValid: boolean;
    errors?: z.ZodError;
    sanitized?: any;
  } {
    const sanitized = this.sanitizeLogEntry({ ...logEntry, category });
    
    try {
      let validated;
      
      switch (category) {
        case 'http':
          validated = HttpLogSchema.parse(sanitized);
          break;
        case 'error':
          validated = ErrorLogSchema.parse(sanitized);
          break;
        case 'performance':
          validated = PerformanceLogSchema.parse(sanitized);
          break;
        case 'database':
          validated = DatabaseLogSchema.parse(sanitized);
          break;
        case 'security':
          validated = SecurityLogSchema.parse(sanitized);
          break;
        case 'business':
          validated = BusinessLogSchema.parse(sanitized);
          break;
        case 'system':
          validated = SystemLogSchema.parse(sanitized);
          break;
        case 'external-api':
          validated = ExternalApiLogSchema.parse(sanitized);
          break;
        default:
          validated = BaseLogSchema.parse(sanitized);
      }
      
      return { isValid: true, sanitized: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.recordValidationError(`Category ${category}: ${error.message}`, logEntry);
        return { isValid: false, errors: error };
      }
      
      this.recordValidationError(`Category ${category}: Unknown validation error`, logEntry);
      return { isValid: false };
    }
  }
  
  // Generate log entry template for a category
  generateTemplate(category: string): any {
    const baseTemplate = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Template message',
      service: 'learning-assistant',
      category,
    };
    
    switch (category) {
      case 'http':
        return {
          ...baseTemplate,
          method: 'GET',
          path: '/api/example',
          statusCode: 200,
          duration: 100,
        };
      
      case 'error':
        return {
          ...baseTemplate,
          level: 'error',
          error: {
            name: 'Error',
            message: 'Example error message',
            stack: 'Error stack trace...',
          },
        };
      
      case 'performance':
        return {
          ...baseTemplate,
          operation: 'example_operation',
          duration: 100,
          responseTime: '100ms',
        };
      
      case 'database':
        return {
          ...baseTemplate,
          operation: 'SELECT',
          table: 'users',
          duration: 50,
        };
      
      case 'security':
        return {
          ...baseTemplate,
          level: 'warn',
          eventType: 'authentication',
          severity: 'medium',
          action: 'user_login',
          outcome: 'success',
        };
      
      case 'business':
        return {
          ...baseTemplate,
          event: 'user_registered',
          action: 'create_user',
          businessEvent: true,
        };
      
      case 'system':
        return {
          ...baseTemplate,
          metric: 'memory_usage',
          value: 100,
          unit: 'MB',
        };
      
      case 'external-api':
        return {
          ...baseTemplate,
          url: 'https://api.example.com/data',
          method: 'GET',
          statusCode: 200,
          duration: 200,
          responseTime: '200ms',
        };
      
      default:
        return baseTemplate;
    }
  }
}

// Singleton validator instance
export const logValidator = LogValidator.getInstance();

// Helper functions for creating validated log entries
export const createValidatedLog = {
  http: (data: Partial<z.infer<typeof HttpLogSchema>>): z.infer<typeof HttpLogSchema> => {
    const result = logValidator.validateCategory('http', data);
    if (!result.isValid) {
      throw new Error(`Invalid HTTP log entry: ${result.errors?.message}`);
    }
    return result.sanitized!;
  },
  
  error: (data: Partial<z.infer<typeof ErrorLogSchema>>): z.infer<typeof ErrorLogSchema> => {
    const result = logValidator.validateCategory('error', data);
    if (!result.isValid) {
      throw new Error(`Invalid error log entry: ${result.errors?.message}`);
    }
    return result.sanitized!;
  },
  
  performance: (data: Partial<z.infer<typeof PerformanceLogSchema>>): z.infer<typeof PerformanceLogSchema> => {
    const result = logValidator.validateCategory('performance', data);
    if (!result.isValid) {
      throw new Error(`Invalid performance log entry: ${result.errors?.message}`);
    }
    return result.sanitized!;
  },
  
  database: (data: Partial<z.infer<typeof DatabaseLogSchema>>): z.infer<typeof DatabaseLogSchema> => {
    const result = logValidator.validateCategory('database', data);
    if (!result.isValid) {
      throw new Error(`Invalid database log entry: ${result.errors?.message}`);
    }
    return result.sanitized!;
  },
  
  security: (data: Partial<z.infer<typeof SecurityLogSchema>>): z.infer<typeof SecurityLogSchema> => {
    const result = logValidator.validateCategory('security', data);
    if (!result.isValid) {
      throw new Error(`Invalid security log entry: ${result.errors?.message}`);
    }
    return result.sanitized!;
  },
  
  business: (data: Partial<z.infer<typeof BusinessLogSchema>>): z.infer<typeof BusinessLogSchema> => {
    const result = logValidator.validateCategory('business', data);
    if (!result.isValid) {
      throw new Error(`Invalid business log entry: ${result.errors?.message}`);
    }
    return result.sanitized!;
  },
  
  system: (data: Partial<z.infer<typeof SystemLogSchema>>): z.infer<typeof SystemLogSchema> => {
    const result = logValidator.validateCategory('system', data);
    if (!result.isValid) {
      throw new Error(`Invalid system log entry: ${result.errors?.message}`);
    }
    return result.sanitized!;
  },
  
  externalApi: (data: Partial<z.infer<typeof ExternalApiLogSchema>>): z.infer<typeof ExternalApiLogSchema> => {
    const result = logValidator.validateCategory('external-api', data);
    if (!result.isValid) {
      throw new Error(`Invalid external API log entry: ${result.errors?.message}`);
    }
    return result.sanitized!;
  },
};

// Export schema types
export type BaseLog = z.infer<typeof BaseLogSchema>;
export type HttpLog = z.infer<typeof HttpLogSchema>;
export type ErrorLog = z.infer<typeof ErrorLogSchema>;
export type PerformanceLog = z.infer<typeof PerformanceLogSchema>;
export type DatabaseLog = z.infer<typeof DatabaseLogSchema>;
export type SecurityLog = z.infer<typeof SecurityLogSchema>;
export type BusinessLog = z.infer<typeof BusinessLogSchema>;
export type SystemLog = z.infer<typeof SystemLogSchema>;
export type ExternalApiLog = z.infer<typeof ExternalApiLogSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;

// Schema registry for dynamic validation
export const schemaRegistry = {
  base: BaseLogSchema,
  http: HttpLogSchema,
  error: ErrorLogSchema,
  performance: PerformanceLogSchema,
  database: DatabaseLogSchema,
  security: SecurityLogSchema,
  business: BusinessLogSchema,
  system: SystemLogSchema,
  'external-api': ExternalApiLogSchema,
  correlation: CorrelationSchema,
  userContext: UserContextSchema,
  sampling: SamplingSchema,
};