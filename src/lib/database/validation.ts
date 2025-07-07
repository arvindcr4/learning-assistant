import { z } from 'zod';
import { Pool, PoolClient } from 'pg';
import { sanitizeUserInput, sanitizeSqlInput } from '@/lib/validation/sanitization';

// ====================
// DATABASE VALIDATION TYPES
// ====================

export interface DatabaseValidationConfig {
  sanitizeInputs?: boolean;
  validateConstraints?: boolean;
  enableParameterizedQueries?: boolean;
  maxQueryLength?: number;
  allowedTables?: string[];
  logQueries?: boolean;
}

export interface QueryValidationResult {
  isValid: boolean;
  sanitizedQuery?: string;
  sanitizedParams?: any[];
  errors?: string[];
  warnings?: string[];
}

export interface DatabaseOperationContext {
  userId?: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  timestamp: Date;
  ip?: string;
}

// ====================
// DATABASE VALIDATOR CLASS
// ====================

export class DatabaseValidator {
  private config: Required<DatabaseValidationConfig>;
  private allowedTables: Set<string>;

  constructor(config: DatabaseValidationConfig = {}) {
    this.config = {
      sanitizeInputs: config.sanitizeInputs !== false,
      validateConstraints: config.validateConstraints !== false,
      enableParameterizedQueries: config.enableParameterizedQueries !== false,
      maxQueryLength: config.maxQueryLength || 10000,
      allowedTables: config.allowedTables || [],
      logQueries: config.logQueries !== false,
    };

    this.allowedTables = new Set(this.config.allowedTables);
  }

  /**
   * Validates and sanitizes SQL queries
   */
  validateQuery(
    query: string, 
    params: any[] = [], 
    context?: DatabaseOperationContext
  ): QueryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Basic query validation
    if (!query || typeof query !== 'string') {
      errors.push('Query must be a non-empty string');
      return { isValid: false, errors };
    }

    if (query.length > this.config.maxQueryLength) {
      errors.push(`Query length exceeds maximum allowed length of ${this.config.maxQueryLength} characters`);
      return { isValid: false, errors };
    }

    // 2. Check for dangerous SQL patterns
    const dangerousPatterns = [
      /;\s*(DROP|CREATE|ALTER|EXEC|EXECUTE)\s+/gi,
      /UNION\s+SELECT/gi,
      /--\s*\w/gi,
      /\/\*[\s\S]*?\*\//gi,
      /'[^']*'[^']*'/gi, // Potential SQL injection
      /\b(xp_|sp_)\w+/gi, // SQL Server extended stored procedures
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        errors.push('Query contains potentially dangerous SQL patterns');
        break;
      }
    }

    // 3. Validate table access
    if (this.allowedTables.size > 0 && context?.table) {
      if (!this.allowedTables.has(context.table)) {
        errors.push(`Access to table '${context.table}' is not allowed`);
      }
    }

    // 4. Validate parameterized queries
    if (this.config.enableParameterizedQueries) {
      const placeholderCount = (query.match(/\$\d+/g) || []).length;
      if (placeholderCount !== params.length) {
        errors.push(`Parameter count mismatch: query has ${placeholderCount} placeholders but ${params.length} parameters provided`);
      }
    }

    // 5. Sanitize inputs if enabled
    let sanitizedQuery = query;
    let sanitizedParams = params;

    if (this.config.sanitizeInputs) {
      sanitizedQuery = sanitizeSqlInput(query);
      sanitizedParams = params.map(param => {
        if (typeof param === 'string') {
          return sanitizeUserInput(param, 'sql');
        }
        return param;
      });

      if (sanitizedQuery !== query) {
        warnings.push('Query was sanitized to remove potentially dangerous content');
      }
    }

    // 6. Log query if enabled
    if (this.config.logQueries && context) {
      this.logDatabaseOperation(sanitizedQuery, sanitizedParams, context);
    }

    return {
      isValid: errors.length === 0,
      sanitizedQuery,
      sanitizedParams,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validates data before database insertion/update
   */
  validateData<T>(
    data: T,
    schema: z.ZodSchema<T>,
    tableName: string
  ): {
    isValid: boolean;
    validatedData?: T;
    errors?: string[];
  } {
    const errors: string[] = [];

    // 1. Schema validation
    const result = schema.safeParse(data);
    if (!result.success) {
      errors.push(...result.error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ));
    }

    // 2. Table-specific validation
    const tableValidationErrors = this.validateTableConstraints(data, tableName);
    if (tableValidationErrors.length > 0) {
      errors.push(...tableValidationErrors);
    }

    // 3. Business rule validation
    const businessRuleErrors = this.validateBusinessRules(data, tableName);
    if (businessRuleErrors.length > 0) {
      errors.push(...businessRuleErrors);
    }

    return {
      isValid: errors.length === 0 && result.success,
      validatedData: result.success ? result.data : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validates table-specific constraints
   */
  private validateTableConstraints(data: any, tableName: string): string[] {
    const errors: string[] = [];

    switch (tableName) {
      case 'users':
        if (data.email && typeof data.email === 'string') {
          // Additional email validation beyond schema
          if (data.email.length > 254) {
            errors.push('Email address is too long');
          }
        }
        break;

      case 'learning_sessions':
        if (data.startTime && data.endTime) {
          const start = new Date(data.startTime);
          const end = new Date(data.endTime);
          if (start >= end) {
            errors.push('End time must be after start time');
          }
          
          // Validate session duration (max 24 hours)
          const duration = end.getTime() - start.getTime();
          if (duration > 24 * 60 * 60 * 1000) {
            errors.push('Session duration cannot exceed 24 hours');
          }
        }
        break;

      case 'assessments':
        if (data.questions && Array.isArray(data.questions)) {
          if (data.questions.length === 0) {
            errors.push('Assessment must have at least one question');
          }
          if (data.questions.length > 100) {
            errors.push('Assessment cannot have more than 100 questions');
          }
        }
        break;

      case 'chat_messages':
        if (data.content && typeof data.content === 'string') {
          if (data.content.length > 10000) {
            errors.push('Message content is too long');
          }
        }
        break;
    }

    return errors;
  }

  /**
   * Validates business rules
   */
  private validateBusinessRules(data: any, tableName: string): string[] {
    const errors: string[] = [];

    switch (tableName) {
      case 'user_progress':
        if (data.score !== undefined && data.score !== null) {
          if (data.score < 0 || data.score > 100) {
            errors.push('Score must be between 0 and 100');
          }
        }
        break;

      case 'learning_paths':
        if (data.estimatedDuration && data.estimatedDuration > 10080) { // 1 week in minutes
          errors.push('Learning path duration cannot exceed 1 week');
        }
        break;

      case 'content':
        if (data.difficulty && (data.difficulty < 1 || data.difficulty > 10)) {
          errors.push('Content difficulty must be between 1 and 10');
        }
        break;
    }

    return errors;
  }

  /**
   * Logs database operations for security monitoring
   */
  private logDatabaseOperation(
    query: string,
    params: any[],
    context: DatabaseOperationContext
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      operation: context.operation,
      table: context.table,
      queryHash: this.hashQuery(query),
      paramCount: params.length,
      ip: context.ip,
    };

    // In a real implementation, you'd send this to your logging service
    console.log('[DB_OPERATION]', JSON.stringify(logEntry));
  }

  /**
   * Creates a hash of the query for logging (without sensitive data)
   */
  private hashQuery(query: string): string {
    // Simple hash for demonstration - use a proper hashing library in production
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
}

// ====================
// SECURE DATABASE WRAPPER
// ====================

export class SecureDatabase {
  private pool: Pool;
  private validator: DatabaseValidator;

  constructor(pool: Pool, config?: DatabaseValidationConfig) {
    this.pool = pool;
    this.validator = new DatabaseValidator(config);
  }

  /**
   * Executes a validated and sanitized query
   */
  async query<T = any>(
    text: string,
    params: any[] = [],
    context?: DatabaseOperationContext
  ): Promise<{ rows: T[]; rowCount: number }> {
    // Validate the query
    const validation = this.validator.validateQuery(text, params, context);
    
    if (!validation.isValid) {
      throw new Error(`Database query validation failed: ${validation.errors?.join(', ')}`);
    }

    // Log warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
      console.warn('[DB_WARNINGS]', validation.warnings);
    }

    try {
      const result = await this.pool.query(validation.sanitizedQuery!, validation.sanitizedParams!);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
      };
    } catch (error) {
      // Log the error for security monitoring
      console.error('[DB_ERROR]', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context,
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  }

  /**
   * Inserts data with validation
   */
  async insert<T>(
    table: string,
    data: T,
    schema: z.ZodSchema<T>,
    userId?: string
  ): Promise<{ rows: T[]; rowCount: number }> {
    // Validate the data
    const validation = this.validator.validateData(data, schema, table);
    
    if (!validation.isValid) {
      throw new Error(`Data validation failed: ${validation.errors?.join(', ')}`);
    }

    const validatedData = validation.validatedData!;
    const columns = Object.keys(validatedData);
    const values = Object.values(validatedData);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    
    return this.query(query, values, {
      userId,
      operation: 'INSERT',
      table,
      timestamp: new Date(),
    });
  }

  /**
   * Updates data with validation
   */
  async update<T>(
    table: string,
    data: Partial<T>,
    where: Record<string, any>,
    schema: z.ZodSchema<Partial<T>>,
    userId?: string
  ): Promise<{ rows: T[]; rowCount: number }> {
    // Validate the data
    const validation = this.validator.validateData(data, schema, table);
    
    if (!validation.isValid) {
      throw new Error(`Data validation failed: ${validation.errors?.join(', ')}`);
    }

    const validatedData = validation.validatedData!;
    const setClause = Object.keys(validatedData)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    
    const whereKeys = Object.keys(where);
    const whereClause = whereKeys
      .map((key, index) => `${key} = $${Object.keys(validatedData).length + index + 1}`)
      .join(' AND ');

    const values = [...Object.values(validatedData), ...Object.values(where)];
    const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`;

    return this.query(query, values, {
      userId,
      operation: 'UPDATE',
      table,
      timestamp: new Date(),
    });
  }

  /**
   * Deletes data with validation
   */
  async delete(
    table: string,
    where: Record<string, any>,
    userId?: string
  ): Promise<{ rows: any[]; rowCount: number }> {
    const whereKeys = Object.keys(where);
    const whereClause = whereKeys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(' AND ');

    const values = Object.values(where);
    const query = `DELETE FROM ${table} WHERE ${whereClause} RETURNING *`;

    return this.query(query, values, {
      userId,
      operation: 'DELETE',
      table,
      timestamp: new Date(),
    });
  }

  /**
   * Selects data with validation
   */
  async select<T = any>(
    table: string,
    where: Record<string, any> = {},
    options: {
      columns?: string[];
      orderBy?: string;
      limit?: number;
      offset?: number;
    } = {},
    userId?: string
  ): Promise<{ rows: T[]; rowCount: number }> {
    const columns = options.columns ? options.columns.join(', ') : '*';
    let query = `SELECT ${columns} FROM ${table}`;
    const values: any[] = [];

    // Add WHERE clause if conditions provided
    if (Object.keys(where).length > 0) {
      const whereKeys = Object.keys(where);
      const whereClause = whereKeys
        .map((key, index) => `${key} = $${index + 1}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      values.push(...Object.values(where));
    }

    // Add ORDER BY clause
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }

    // Add LIMIT clause
    if (options.limit) {
      query += ` LIMIT $${values.length + 1}`;
      values.push(options.limit);
    }

    // Add OFFSET clause
    if (options.offset) {
      query += ` OFFSET $${values.length + 1}`;
      values.push(options.offset);
    }

    return this.query(query, values, {
      userId,
      operation: 'SELECT',
      table,
      timestamp: new Date(),
    });
  }

  /**
   * Executes a transaction with validation
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    userId?: string
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Log transaction start
      console.log('[DB_TRANSACTION_START]', {
        userId,
        timestamp: new Date().toISOString(),
      });
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      
      // Log transaction success
      console.log('[DB_TRANSACTION_COMMIT]', {
        userId,
        timestamp: new Date().toISOString(),
      });
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Log transaction failure
      console.error('[DB_TRANSACTION_ROLLBACK]', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    } finally {
      client.release();
    }
  }
}

// ====================
// VALIDATION SCHEMAS FOR COMMON TABLES
// ====================

export const userTableSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(100),
  email: z.string().email().max(254),
  password_hash: z.string().optional(),
  avatar: z.string().url().optional(),
  preferences: z.record(z.any()).optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const learningSessionTableSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  content_id: z.string().max(100),
  module_id: z.string().max(100).optional(),
  path_id: z.string().max(100).optional(),
  start_time: z.date(),
  end_time: z.date().optional(),
  duration: z.number().min(0).max(86400),
  items_completed: z.number().min(0).max(1000).default(0),
  correct_answers: z.number().min(0).max(1000).default(0),
  total_questions: z.number().min(0).max(1000).default(0),
  score: z.number().min(0).max(100).optional(),
  completed: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
  engagement_metrics: z.record(z.any()).optional(),
  created_at: z.date().optional(),
});

export const chatMessageTableSchema = z.object({
  id: z.string().uuid().optional(),
  session_id: z.string().max(100),
  content: z.string().min(1).max(10000),
  role: z.enum(['user', 'assistant', 'system']),
  context: z.record(z.any()).optional(),
  attachments: z.array(z.any()).optional(),
  tokens: z.number().min(0).optional(),
  created_at: z.date().optional(),
});

// ====================
// EXPORTS
// ====================

export default {
  DatabaseValidator,
  SecureDatabase,
  userTableSchema,
  learningSessionTableSchema,
  chatMessageTableSchema,
};