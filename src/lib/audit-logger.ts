import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { correlationManager } from './correlation';

// Security audit event types
export enum AuditEventType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  SYSTEM_ACCESS = 'system_access',
  CONFIGURATION_CHANGE = 'configuration_change',
  SECURITY_VIOLATION = 'security_violation',
  ADMIN_ACTION = 'admin_action',
  API_ACCESS = 'api_access',
  FILE_ACCESS = 'file_access',
  PAYMENT_TRANSACTION = 'payment_transaction',
  PRIVACY_EVENT = 'privacy_event',
  COMPLIANCE_EVENT = 'compliance_event',
}

// Audit event severity levels
export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Audit event interface
export interface AuditEvent {
  eventType: AuditEventType;
  severity: AuditSeverity;
  action: string;
  resource?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  correlationId?: string;
  traceId?: string;
  outcome: 'success' | 'failure' | 'error';
  details?: Record<string, any>;
  sensitive?: boolean;
  complianceFlags?: string[];
  riskScore?: number;
}

// PII detection patterns
const PII_PATTERNS = [
  /\b\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\b/, // Credit card
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
  /\b\d{3}-\d{3}-\d{4}\b/, // Phone number
];

// Audit logger configuration
const auditLogFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const {
      timestamp,
      level,
      message,
      eventType,
      severity,
      action,
      resource,
      userId,
      sessionId,
      ipAddress,
      userAgent,
      correlationId,
      traceId,
      outcome,
      details,
      sensitive,
      complianceFlags,
      riskScore,
      ...meta
    } = info;

    const auditEntry = {
      timestamp,
      level,
      message,
      eventType,
      severity,
      action,
      resource,
      userId,
      sessionId,
      ipAddress,
      userAgent,
      correlationId,
      traceId,
      outcome,
      details: sensitive ? '[REDACTED]' : details,
      sensitive,
      complianceFlags,
      riskScore,
      service: 'learning-assistant',
      environment: process.env.NODE_ENV,
      auditVersion: '1.0',
      ...meta
    };

    return JSON.stringify(auditEntry);
  })
);

// Create audit logger transports
const auditTransports: winston.transport[] = [];

// Console transport for development
if (process.env.NODE_ENV === 'development') {
  auditTransports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  );
}

// File transport for audit logs
auditTransports.push(
  new DailyRotateFile({
    filename: 'logs/audit-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '365d', // Keep audit logs for 1 year
    format: auditLogFormat,
    auditFile: 'logs/audit-hash.json', // File integrity checking
  })
);

// High-severity audit events get a separate file
auditTransports.push(
  new DailyRotateFile({
    filename: 'logs/audit-critical-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '1095d', // Keep critical logs for 3 years
    format: auditLogFormat,
    level: 'error', // Only critical events
    auditFile: 'logs/audit-critical-hash.json',
  })
);

// Create Winston audit logger
const auditWinstonLogger = winston.createLogger({
  level: 'info',
  format: auditLogFormat,
  transports: auditTransports,
  exitOnError: false,
});

// Audit logger class
export class AuditLogger {
  private static instance: AuditLogger;
  private logger: winston.Logger;
  
  private constructor() {
    this.logger = auditWinstonLogger;
  }
  
  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }
  
  // Log audit event
  logEvent(event: AuditEvent): void {
    // Add correlation context if available
    const correlationContext = correlationManager.getLoggingContext();
    const enrichedEvent = {
      ...event,
      correlationId: event.correlationId || correlationContext.correlationId,
      traceId: event.traceId || correlationContext.traceId,
    };
    
    // Determine log level based on severity
    const logLevel = this.getLogLevel(event.severity);
    
    // Check for PII and mark as sensitive
    if (this.containsPII(JSON.stringify(event.details))) {
      enrichedEvent.sensitive = true;
    }
    
    // Calculate risk score if not provided
    if (!enrichedEvent.riskScore) {
      enrichedEvent.riskScore = this.calculateRiskScore(enrichedEvent);
    }
    
    // Log the audit event
    this.logger.log(logLevel, `${event.eventType}: ${event.action}`, enrichedEvent);
    
    // Send alerts for high-severity events
    if (event.severity === AuditSeverity.CRITICAL) {
      this.sendCriticalAlert(enrichedEvent);
    }
  }
  
  // Authentication events
  logAuthentication(
    action: string,
    userId?: string,
    outcome: 'success' | 'failure' | 'error' = 'success',
    details?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: AuditEventType.AUTHENTICATION,
      severity: outcome === 'success' ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
      action,
      userId,
      timestamp: new Date().toISOString(),
      outcome,
      details,
      complianceFlags: ['SOC2', 'GDPR'],
    });
  }
  
  // Authorization events
  logAuthorization(
    action: string,
    resource: string,
    userId?: string,
    outcome: 'success' | 'failure' | 'error' = 'success',
    details?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: AuditEventType.AUTHORIZATION,
      severity: outcome === 'success' ? AuditSeverity.LOW : AuditSeverity.HIGH,
      action,
      resource,
      userId,
      timestamp: new Date().toISOString(),
      outcome,
      details,
      complianceFlags: ['SOC2', 'RBAC'],
    });
  }
  
  // Data access events
  logDataAccess(
    action: string,
    resource: string,
    userId?: string,
    outcome: 'success' | 'failure' | 'error' = 'success',
    details?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: AuditEventType.DATA_ACCESS,
      severity: AuditSeverity.LOW,
      action,
      resource,
      userId,
      timestamp: new Date().toISOString(),
      outcome,
      details,
      complianceFlags: ['GDPR', 'HIPAA'],
    });
  }
  
  // Data modification events
  logDataModification(
    action: string,
    resource: string,
    userId?: string,
    outcome: 'success' | 'failure' | 'error' = 'success',
    details?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: AuditEventType.DATA_MODIFICATION,
      severity: AuditSeverity.MEDIUM,
      action,
      resource,
      userId,
      timestamp: new Date().toISOString(),
      outcome,
      details,
      complianceFlags: ['GDPR', 'SOC2'],
    });
  }
  
  // Security violation events
  logSecurityViolation(
    action: string,
    severity: AuditSeverity = AuditSeverity.HIGH,
    details?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: AuditEventType.SECURITY_VIOLATION,
      severity,
      action,
      timestamp: new Date().toISOString(),
      outcome: 'failure',
      details,
      complianceFlags: ['SOC2', 'ISO27001'],
    });
  }
  
  // Admin action events
  logAdminAction(
    action: string,
    resource: string,
    userId?: string,
    outcome: 'success' | 'failure' | 'error' = 'success',
    details?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: AuditEventType.ADMIN_ACTION,
      severity: AuditSeverity.HIGH,
      action,
      resource,
      userId,
      timestamp: new Date().toISOString(),
      outcome,
      details,
      complianceFlags: ['SOC2', 'RBAC'],
    });
  }
  
  // API access events
  logApiAccess(
    action: string,
    resource: string,
    userId?: string,
    outcome: 'success' | 'failure' | 'error' = 'success',
    details?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: AuditEventType.API_ACCESS,
      severity: AuditSeverity.LOW,
      action,
      resource,
      userId,
      timestamp: new Date().toISOString(),
      outcome,
      details,
      complianceFlags: ['API_SECURITY'],
    });
  }
  
  // Privacy events
  logPrivacyEvent(
    action: string,
    userId?: string,
    outcome: 'success' | 'failure' | 'error' = 'success',
    details?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: AuditEventType.PRIVACY_EVENT,
      severity: AuditSeverity.MEDIUM,
      action,
      userId,
      timestamp: new Date().toISOString(),
      outcome,
      details,
      sensitive: true,
      complianceFlags: ['GDPR', 'CCPA'],
    });
  }
  
  // Compliance events
  logComplianceEvent(
    action: string,
    complianceFlags: string[],
    severity: AuditSeverity = AuditSeverity.MEDIUM,
    details?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: AuditEventType.COMPLIANCE_EVENT,
      severity,
      action,
      timestamp: new Date().toISOString(),
      outcome: 'success',
      details,
      complianceFlags,
    });
  }
  
  // Helper methods
  private getLogLevel(severity: AuditSeverity): string {
    switch (severity) {
      case AuditSeverity.LOW:
        return 'info';
      case AuditSeverity.MEDIUM:
        return 'warn';
      case AuditSeverity.HIGH:
      case AuditSeverity.CRITICAL:
        return 'error';
      default:
        return 'info';
    }
  }
  
  private containsPII(text: string): boolean {
    return PII_PATTERNS.some(pattern => pattern.test(text));
  }
  
  private calculateRiskScore(event: AuditEvent): number {
    let score = 0;
    
    // Base score by event type
    switch (event.eventType) {
      case AuditEventType.AUTHENTICATION:
        score += event.outcome === 'failure' ? 30 : 10;
        break;
      case AuditEventType.AUTHORIZATION:
        score += event.outcome === 'failure' ? 50 : 20;
        break;
      case AuditEventType.SECURITY_VIOLATION:
        score += 80;
        break;
      case AuditEventType.DATA_MODIFICATION:
        score += 40;
        break;
      case AuditEventType.ADMIN_ACTION:
        score += 60;
        break;
      default:
        score += 10;
    }
    
    // Severity multiplier
    switch (event.severity) {
      case AuditSeverity.LOW:
        score *= 1;
        break;
      case AuditSeverity.MEDIUM:
        score *= 1.5;
        break;
      case AuditSeverity.HIGH:
        score *= 2;
        break;
      case AuditSeverity.CRITICAL:
        score *= 3;
        break;
    }
    
    // Failure/error penalty
    if (event.outcome !== 'success') {
      score *= 2;
    }
    
    // Sensitive data penalty
    if (event.sensitive) {
      score *= 1.5;
    }
    
    return Math.min(100, Math.round(score));
  }
  
  private sendCriticalAlert(event: AuditEvent): void {
    // This would integrate with your alerting system
    // For now, just log a critical message
    console.error('CRITICAL AUDIT EVENT:', {
      eventType: event.eventType,
      action: event.action,
      userId: event.userId,
      correlationId: event.correlationId,
      riskScore: event.riskScore,
    });
    
    // TODO: Integrate with alerting systems like PagerDuty, Slack, etc.
  }
  
  // Audit trail search and reporting
  searchAuditLogs(criteria: {
    eventType?: AuditEventType;
    userId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    severity?: AuditSeverity;
    outcome?: 'success' | 'failure' | 'error';
  }): Promise<AuditEvent[]> {
    // This would integrate with your log storage system
    // For now, return empty array
    return Promise.resolve([]);
  }
  
  // Generate compliance reports
  generateComplianceReport(
    complianceFramework: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<{
    framework: string;
    period: { from: Date; to: Date };
    events: AuditEvent[];
    summary: Record<string, number>;
  }> {
    // This would generate compliance-specific reports
    return Promise.resolve({
      framework: complianceFramework,
      period: { from: dateFrom, to: dateTo },
      events: [],
      summary: {},
    });
  }
}

// Singleton instance
export const auditLogger = AuditLogger.getInstance();

// Convenience functions for common audit events
export const auditUtils = {
  logLogin: (userId: string, success: boolean, details?: Record<string, any>) => {
    auditLogger.logAuthentication(
      'user_login',
      userId,
      success ? 'success' : 'failure',
      details
    );
  },
  
  logLogout: (userId: string, details?: Record<string, any>) => {
    auditLogger.logAuthentication('user_logout', userId, 'success', details);
  },
  
  logPasswordChange: (userId: string, success: boolean, details?: Record<string, any>) => {
    auditLogger.logAuthentication(
      'password_change',
      userId,
      success ? 'success' : 'failure',
      details
    );
  },
  
  logDataExport: (userId: string, resource: string, details?: Record<string, any>) => {
    auditLogger.logDataAccess('data_export', resource, userId, 'success', details);
  },
  
  logDataDeletion: (userId: string, resource: string, details?: Record<string, any>) => {
    auditLogger.logDataModification('data_deletion', resource, userId, 'success', details);
  },
  
  logPermissionChange: (adminId: string, targetUserId: string, details?: Record<string, any>) => {
    auditLogger.logAdminAction(
      'permission_change',
      `user:${targetUserId}`,
      adminId,
      'success',
      details
    );
  },
  
  logSuspiciousActivity: (details: Record<string, any>) => {
    auditLogger.logSecurityViolation('suspicious_activity', AuditSeverity.HIGH, details);
  },
  
  logRateLimitExceeded: (userId?: string, details?: Record<string, any>) => {
    auditLogger.logSecurityViolation('rate_limit_exceeded', AuditSeverity.MEDIUM, {
      userId,
      ...details,
    });
  },
};

// Middleware for automatic audit logging
export function auditMiddleware(req: any, res: any, next: () => void) {
  const correlationContext = correlationManager.getCurrentContext();
  
  // Log API access
  auditLogger.logApiAccess(
    `${req.method} ${req.url}`,
    req.url,
    req.user?.id || req.userId,
    'success',
    {
      userAgent: req.headers['user-agent'],
      ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      correlationId: correlationContext?.correlationId,
    }
  );
  
  // Override res.end to capture response status
  const originalEnd = res.end;
  res.end = function(chunk: any, encoding: any) {
    const outcome = res.statusCode >= 400 ? 'failure' : 'success';
    
    if (res.statusCode >= 400) {
      auditLogger.logApiAccess(
        `${req.method} ${req.url}`,
        req.url,
        req.user?.id || req.userId,
        outcome,
        {
          statusCode: res.statusCode,
          userAgent: req.headers['user-agent'],
          ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
          correlationId: correlationContext?.correlationId,
        }
      );
    }
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

// Export event types and severity for external use
export { AuditEventType, AuditSeverity };