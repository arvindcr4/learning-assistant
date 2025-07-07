import { Pool, PoolClient, QueryResult } from 'pg';
import { z } from 'zod';
import { DatabaseValidator, SecureDatabase, type DatabaseValidationConfig } from './validation';

// ====================
// ENHANCED SECURITY LAYER
// ====================

export interface SecurityPolicy {
  maxQueryLength: number;
  allowedTables: string[];
  allowedOperations: ('SELECT' | 'INSERT' | 'UPDATE' | 'DELETE')[];
  requireParameterizedQueries: boolean;
  enableQueryLogging: boolean;
  enableSqlInjectionDetection: boolean;
  rateLimitQueries: boolean;
  maxQueriesPerMinute: number;
  enableDataMasking: boolean;
  sensitiveFields: string[];
}

export interface QueryContext {
  userId?: string;
  userRole?: string;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  operation: string;
  table?: string;
  timestamp: Date;
}

export class EnhancedSecurityDatabase extends SecureDatabase {
  private securityPolicy: SecurityPolicy;
  private queryRateLimit: Map<string, number[]> = new Map();
  private suspiciousActivityLog: Array<{
    timestamp: Date;
    context: QueryContext;
    reason: string;
    query: string;
  }> = [];

  constructor(pool: Pool, config?: DatabaseValidationConfig, securityPolicy?: Partial<SecurityPolicy>) {
    super(pool, config);
    
    this.securityPolicy = {
      maxQueryLength: securityPolicy?.maxQueryLength || 10000,
      allowedTables: securityPolicy?.allowedTables || [],
      allowedOperations: securityPolicy?.allowedOperations || ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      requireParameterizedQueries: securityPolicy?.requireParameterizedQueries !== false,
      enableQueryLogging: securityPolicy?.enableQueryLogging !== false,
      enableSqlInjectionDetection: securityPolicy?.enableSqlInjectionDetection !== false,
      rateLimitQueries: securityPolicy?.rateLimitQueries !== false,
      maxQueriesPerMinute: securityPolicy?.maxQueriesPerMinute || 60,
      enableDataMasking: securityPolicy?.enableDataMasking !== false,
      sensitiveFields: securityPolicy?.sensitiveFields || ['password', 'email', 'phone', 'ssn', 'credit_card'],
    };
  }

  /**
   * Enhanced query execution with comprehensive security checks
   */
  public async secureQuery<T = any>(
    text: string,
    params: any[] = [],
    context: QueryContext
  ): Promise<{ rows: T[]; rowCount: number }> {
    // 1. Rate limiting check
    if (this.securityPolicy.rateLimitQueries && !this.checkRateLimit(context)) {
      this.logSuspiciousActivity(context, 'Rate limit exceeded', text);
      throw new Error('Rate limit exceeded. Too many queries from this source.');
    }

    // 2. SQL injection detection
    if (this.securityPolicy.enableSqlInjectionDetection && this.detectSqlInjection(text, params)) {
      this.logSuspiciousActivity(context, 'Potential SQL injection detected', text);
      throw new Error('Security violation: Potential SQL injection detected');
    }

    // 3. Operation authorization
    if (!this.authorizeOperation(text, context)) {
      this.logSuspiciousActivity(context, 'Unauthorized operation', text);
      throw new Error('Security violation: Operation not authorized');
    }

    // 4. Table access validation
    if (!this.validateTableAccess(text, context)) {
      this.logSuspiciousActivity(context, 'Unauthorized table access', text);
      throw new Error('Security violation: Table access not authorized');
    }

    // 5. Execute with enhanced validation
    const result = await super.query(text, params, context);

    // 6. Apply data masking if enabled
    if (this.securityPolicy.enableDataMasking && result.rows.length > 0) {
      result.rows = this.maskSensitiveData(result.rows, context);
    }

    // 7. Log successful query
    if (this.securityPolicy.enableQueryLogging) {
      this.logQueryExecution(text, params, context, result.rowCount);
    }

    return result;
  }

  /**
   * Rate limiting implementation
   */
  private checkRateLimit(context: QueryContext): boolean {
    const key = context.userId || context.ip || 'anonymous';
    const now = Date.now();
    const windowMs = 60000; // 1 minute

    if (!this.queryRateLimit.has(key)) {
      this.queryRateLimit.set(key, []);
    }

    const requests = this.queryRateLimit.get(key)!;
    
    // Remove requests older than the window
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    
    if (validRequests.length >= this.securityPolicy.maxQueriesPerMinute) {
      return false;
    }

    validRequests.push(now);
    this.queryRateLimit.set(key, validRequests);
    
    return true;
  }

  /**
   * SQL injection detection
   */
  private detectSqlInjection(query: string, params: any[]): boolean {
    // Patterns that indicate potential SQL injection
    const dangerousPatterns = [
      // Union-based injection
      /UNION\s+(ALL\s+)?SELECT/i,
      // Stacked queries
      /;\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)/i,
      // Comment-based injection
      /\/\*[\s\S]*?\*\/|--[^\n]*|#[^\n]*/,
      // Boolean-based injection
      /\b(OR|AND)\s+\d+\s*=\s*\d+/i,
      // Time-based injection
      /\b(WAITFOR|SLEEP|BENCHMARK)\s*\(/i,
      // Function-based injection
      /\b(LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)/i,
      // System function calls
      /\b(xp_|sp_)\w+/i,
      // Hex encoding
      /0x[0-9a-f]+/i,
      // Conditional comments
      /\/\*!\d+/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        return true;
      }
    }

    // Check for unescaped quotes with content
    if (this.securityPolicy.requireParameterizedQueries) {
      const quotedStrings = query.match(/'[^']*'/g) || [];
      for (const quotedString of quotedStrings) {
        // If we find quotes with SQL keywords, it's suspicious
        if (/\b(SELECT|INSERT|UPDATE|DELETE|UNION|WHERE|ORDER|GROUP)\b/i.test(quotedString)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Operation authorization based on user context
   */
  private authorizeOperation(query: string, context: QueryContext): boolean {
    const operation = this.extractOperation(query);
    
    if (!this.securityPolicy.allowedOperations.includes(operation as any)) {
      return false;
    }

    // Role-based authorization (can be extended)
    if (context.userRole) {
      switch (context.userRole) {
        case 'readonly':
          return operation === 'SELECT';
        case 'user':
          return ['SELECT', 'INSERT', 'UPDATE'].includes(operation);
        case 'admin':
          return true;
        default:
          return operation === 'SELECT';
      }
    }

    return true;
  }

  /**
   * Table access validation
   */
  private validateTableAccess(query: string, context: QueryContext): boolean {
    if (this.securityPolicy.allowedTables.length === 0) {
      return true; // No restrictions
    }

    const tables = this.extractTables(query);
    
    for (const table of tables) {
      if (!this.securityPolicy.allowedTables.includes(table)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract SQL operation from query
   */
  private extractOperation(query: string): string {
    const match = query.trim().match(/^\s*(\w+)/i);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
  }

  /**
   * Extract table names from query
   */
  private extractTables(query: string): string[] {
    const tables: string[] = [];
    
    // Simple regex to extract table names (can be enhanced)
    const patterns = [
      /FROM\s+(\w+)/gi,
      /JOIN\s+(\w+)/gi,
      /UPDATE\s+(\w+)/gi,
      /INSERT\s+INTO\s+(\w+)/gi,
      /DELETE\s+FROM\s+(\w+)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        tables.push(match[1].toLowerCase());
      }
    }

    return [...new Set(tables)]; // Remove duplicates
  }

  /**
   * Mask sensitive data in query results
   */
  private maskSensitiveData<T extends Record<string, any>>(rows: T[], context: QueryContext): T[] {
    if (!this.securityPolicy.enableDataMasking) {
      return rows;
    }

    return rows.map(row => {
      const maskedRow = { ...row };
      
      for (const field of this.securityPolicy.sensitiveFields) {
        if (field in maskedRow) {
          // Only mask for non-admin users
          if (context.userRole !== 'admin') {
            maskedRow[field] = this.maskValue(maskedRow[field], field);
          }
        }
      }
      
      return maskedRow;
    });
  }

  /**
   * Mask individual values based on field type
   */
  private maskValue(value: any, fieldName: string): any {
    if (value === null || value === undefined) {
      return value;
    }

    const valueStr = String(value);
    
    switch (fieldName.toLowerCase()) {
      case 'email':
        const [localPart, domain] = valueStr.split('@');
        if (localPart && domain) {
          const maskedLocal = localPart.charAt(0) + '*'.repeat(Math.max(0, localPart.length - 2)) + localPart.slice(-1);
          return `${maskedLocal}@${domain}`;
        }
        return '***@***.***';
      
      case 'phone':
        return valueStr.replace(/\d(?=\d{4})/g, '*');
      
      case 'password':
        return '***MASKED***';
      
      case 'ssn':
        return '***-**-' + valueStr.slice(-4);
      
      case 'credit_card':
        return '**** **** **** ' + valueStr.slice(-4);
      
      default:
        // Generic masking for other sensitive fields
        if (valueStr.length <= 4) {
          return '*'.repeat(valueStr.length);
        }
        return valueStr.charAt(0) + '*'.repeat(valueStr.length - 2) + valueStr.slice(-1);
    }
  }

  /**
   * Log suspicious activity
   */
  private logSuspiciousActivity(context: QueryContext, reason: string, query: string): void {
    const logEntry = {
      timestamp: new Date(),
      context,
      reason,
      query: query.substring(0, 500), // Truncate long queries
    };

    this.suspiciousActivityLog.push(logEntry);

    // Keep only recent entries (last 1000)
    if (this.suspiciousActivityLog.length > 1000) {
      this.suspiciousActivityLog = this.suspiciousActivityLog.slice(-1000);
    }

    // Log to console/monitoring system
    console.warn('[SECURITY_ALERT]', {
      timestamp: logEntry.timestamp.toISOString(),
      userId: context.userId,
      ip: context.ip,
      reason,
      queryPreview: query.substring(0, 100),
    });
  }

  /**
   * Log successful query execution
   */
  private logQueryExecution(query: string, params: any[], context: QueryContext, rowCount: number): void {
    console.log('[QUERY_LOG]', {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      operation: context.operation,
      table: context.table,
      rowCount,
      queryHash: this.hashQuery(query),
      paramCount: params.length,
    });
  }

  /**
   * Generate query hash for logging
   */
  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Get security metrics
   */
  public getSecurityMetrics(): {
    totalQueries: number;
    blockedQueries: number;
    suspiciousActivity: number;
    topBlockedReasons: Array<{ reason: string; count: number }>;
    rateLimit: { activeUsers: number; queriesLastMinute: number };
  } {
    const blockedQueries = this.suspiciousActivityLog.length;
    const recentActivity = this.suspiciousActivityLog.filter(
      entry => Date.now() - entry.timestamp.getTime() < 3600000 // Last hour
    );

    const reasonCounts = recentActivity.reduce((acc, entry) => {
      acc[entry.reason] = (acc[entry.reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topBlockedReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalQueries: 0, // Would need to be tracked separately
      blockedQueries,
      suspiciousActivity: recentActivity.length,
      topBlockedReasons,
      rateLimit: {
        activeUsers: this.queryRateLimit.size,
        queriesLastMinute: Array.from(this.queryRateLimit.values())
          .flat()
          .filter(timestamp => Date.now() - timestamp < 60000)
          .length,
      },
    };
  }

  /**
   * Clear old rate limit entries
   */
  public cleanupRateLimit(): void {
    const now = Date.now();
    const windowMs = 60000;

    for (const [key, requests] of this.queryRateLimit.entries()) {
      const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
      
      if (validRequests.length === 0) {
        this.queryRateLimit.delete(key);
      } else {
        this.queryRateLimit.set(key, validRequests);
      }
    }
  }
}

// ====================
// DATABASE PERFORMANCE MONITORING
// ====================

export class DatabasePerformanceMonitor {
  private queryMetrics: Map<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    maxTime: number;
    minTime: number;
    lastExecuted: Date;
    slowQueries: number;
  }> = new Map();

  private slowQueryThreshold: number;

  constructor(slowQueryThreshold: number = 1000) {
    this.slowQueryThreshold = slowQueryThreshold;
  }

  public recordQuery(queryHash: string, executionTime: number): void {
    const existing = this.queryMetrics.get(queryHash);
    
    if (existing) {
      existing.count++;
      existing.totalTime += executionTime;
      existing.avgTime = existing.totalTime / existing.count;
      existing.maxTime = Math.max(existing.maxTime, executionTime);
      existing.minTime = Math.min(existing.minTime, executionTime);
      existing.lastExecuted = new Date();
      
      if (executionTime > this.slowQueryThreshold) {
        existing.slowQueries++;
      }
    } else {
      this.queryMetrics.set(queryHash, {
        count: 1,
        totalTime: executionTime,
        avgTime: executionTime,
        maxTime: executionTime,
        minTime: executionTime,
        lastExecuted: new Date(),
        slowQueries: executionTime > this.slowQueryThreshold ? 1 : 0,
      });
    }
  }

  public getPerformanceReport(): {
    totalQueries: number;
    averageExecutionTime: number;
    slowQueries: number;
    topSlowQueries: Array<{ hash: string; avgTime: number; count: number }>;
    queryDistribution: Array<{ timeRange: string; count: number }>;
  } {
    const metrics = Array.from(this.queryMetrics.values());
    
    const totalQueries = metrics.reduce((sum, metric) => sum + metric.count, 0);
    const totalTime = metrics.reduce((sum, metric) => sum + metric.totalTime, 0);
    const averageExecutionTime = totalQueries > 0 ? totalTime / totalQueries : 0;
    const slowQueries = metrics.reduce((sum, metric) => sum + metric.slowQueries, 0);

    const topSlowQueries = Array.from(this.queryMetrics.entries())
      .map(([hash, metric]) => ({ hash, avgTime: metric.avgTime, count: metric.count }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    const queryDistribution = [
      { timeRange: '< 100ms', count: 0 },
      { timeRange: '100-500ms', count: 0 },
      { timeRange: '500ms-1s', count: 0 },
      { timeRange: '1s-5s', count: 0 },
      { timeRange: '> 5s', count: 0 },
    ];

    metrics.forEach(metric => {
      if (metric.avgTime < 100) queryDistribution[0].count += metric.count;
      else if (metric.avgTime < 500) queryDistribution[1].count += metric.count;
      else if (metric.avgTime < 1000) queryDistribution[2].count += metric.count;
      else if (metric.avgTime < 5000) queryDistribution[3].count += metric.count;
      else queryDistribution[4].count += metric.count;
    });

    return {
      totalQueries,
      averageExecutionTime,
      slowQueries,
      topSlowQueries,
      queryDistribution,
    };
  }

  public clearMetrics(): void {
    this.queryMetrics.clear();
  }
}

// ====================
// EXPORTS
// ====================

export default {
  EnhancedSecurityDatabase,
  DatabasePerformanceMonitor,
};