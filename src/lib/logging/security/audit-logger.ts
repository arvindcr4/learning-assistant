/**
 * Security Audit Logger
 * 
 * Comprehensive security event logging for:
 * - Authentication and authorization events
 * - Security threats and attacks
 * - Compliance and regulatory requirements
 * - Data access and privacy events
 * - System security events
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { logger } from '../core/logger';
import { SecurityEvent, SecurityEventType, SecurityEventSeverity, AuditEvent, DataAccessEvent, LogContext } from '../types';
import { correlationManager } from '../../correlation';
import { sensitiveDataScrubber } from '../utils/formatters';

// Security logger configuration
interface SecurityLoggerConfig {
  enabled: boolean;
  level: 'info' | 'warn' | 'error';
  retentionDays: number;
  encryptLogs: boolean;
  alertingEnabled: boolean;
  complianceMode: boolean;
  sensitiveDataMasking: boolean;
  realTimeAlerting: boolean;
}

// Default configuration
const defaultConfig: SecurityLoggerConfig = {
  enabled: true,
  level: 'warn',
  retentionDays: 2555, // 7 years for compliance
  encryptLogs: process.env.NODE_ENV === 'production',
  alertingEnabled: process.env.NODE_ENV === 'production',
  complianceMode: process.env.COMPLIANCE_MODE === 'true',
  sensitiveDataMasking: true,
  realTimeAlerting: process.env.SECURITY_REAL_TIME_ALERTS === 'true'
};

// Security risk scoring
interface RiskScore {
  score: number; // 0-100
  factors: string[];
  severity: SecurityEventSeverity;
}

/**
 * Enhanced Security Audit Logger
 */
export class SecurityAuditLogger {
  private config: SecurityLoggerConfig;
  private securityLogger: winston.Logger;
  private auditLogger: winston.Logger;
  private eventCounters: Map<string, { count: number; lastSeen: Date }> = new Map();
  private riskScoreCache: Map<string, RiskScore> = new Map();

  constructor(config: Partial<SecurityLoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.securityLogger = this.createSecurityLogger();
    this.auditLogger = this.createAuditLogger();
  }

  /**
   * Create dedicated security logger
   */
  private createSecurityLogger(): winston.Logger {
    const format = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        const sanitizedMeta = this.config.sensitiveDataMasking ? 
          sensitiveDataScrubber(meta) : meta;

        return JSON.stringify({
          timestamp,
          level,
          message,
          service: 'learning-assistant',
          environment: process.env.NODE_ENV,
          category: 'security',
          logType: 'security_event',
          ...sanitizedMeta
        });
      })
    );

    const transports: winston.transport[] = [
      // Console transport for immediate visibility
      new winston.transports.Console({
        format,
        level: this.config.level
      })
    ];

    // File transport for production
    if (process.env.NODE_ENV === 'production') {
      transports.push(
        new DailyRotateFile({
          filename: 'logs/security/security-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '50m',
          maxFiles: `${this.config.retentionDays}d`,
          format,
          level: 'warn'
        })
      );

      // Critical security events get separate file
      transports.push(
        new DailyRotateFile({
          filename: 'logs/security/critical-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '50m',
          maxFiles: `${this.config.retentionDays}d`,
          format,
          level: 'error'
        })
      );
    }

    return winston.createLogger({
      level: this.config.level,
      format,
      transports,
      exitOnError: false,
      silent: process.env.NODE_ENV === 'test'
    });
  }

  /**
   * Create dedicated audit logger
   */
  private createAuditLogger(): winston.Logger {
    const format = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.json(),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        const sanitizedMeta = this.config.sensitiveDataMasking ? 
          sensitiveDataScrubber(meta) : meta;

        return JSON.stringify({
          timestamp,
          level,
          message,
          service: 'learning-assistant',
          environment: process.env.NODE_ENV,
          category: 'audit',
          logType: 'audit_event',
          ...sanitizedMeta
        });
      })
    );

    const transports: winston.transport[] = [];

    // File transport for audit logs (immutable)
    if (process.env.NODE_ENV === 'production') {
      transports.push(
        new DailyRotateFile({
          filename: 'logs/audit/audit-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '100m',
          maxFiles: `${this.config.retentionDays}d`,
          format,
          level: 'info'
        })
      );
    }

    return winston.createLogger({
      level: 'info',
      format,
      transports,
      exitOnError: false,
      silent: process.env.NODE_ENV === 'test'
    });
  }

  /**
   * Log a security event
   */
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp' | 'correlationId'>): void {
    if (!this.config.enabled) return;

    const correlationId = correlationManager.getCurrentCorrelationId();
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
      correlationId
    };

    // Calculate risk score
    const riskScore = this.calculateRiskScore(securityEvent);
    securityEvent.riskScore = riskScore.score;

    // Update event counters
    this.updateEventCounters(securityEvent);

    // Determine log level
    const logLevel = this.getLogLevel(securityEvent.severity);

    // Log the event
    const logData = {
      ...securityEvent,
      riskScore: riskScore.score,
      riskFactors: riskScore.factors,
      securityEvent: true
    };

    this.securityLogger.log(logLevel, `Security Event: ${securityEvent.type} - ${securityEvent.message}`, logData);

    // Also log to main logger for visibility
    logger.log(logLevel, `Security Event: ${securityEvent.type} - ${securityEvent.message}`, {
      ...logData,
      category: 'security'
    });

    // Send alerts for critical events
    if (this.shouldAlert(securityEvent)) {
      this.sendSecurityAlert(securityEvent, riskScore);
    }

    // Check for patterns that might indicate ongoing attacks
    this.analyzeAttackPatterns(securityEvent);
  }

  /**
   * Log authentication success
   */
  logAuthenticationSuccess(
    userId: string,
    ip: string,
    userAgent: string,
    method: string = 'password',
    metadata?: Record<string, any>
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.AUTHENTICATION_SUCCESS,
      severity: SecurityEventSeverity.LOW,
      message: `User ${userId} authenticated successfully via ${method}`,
      userId,
      ip,
      userAgent,
      outcome: 'success',
      details: {
        authenticationMethod: method,
        ...metadata
      }
    });
  }

  /**
   * Log authentication failure
   */
  logAuthenticationFailure(
    userId: string,
    ip: string,
    userAgent: string,
    reason: string,
    metadata?: Record<string, any>
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.AUTHENTICATION_FAILURE,
      severity: SecurityEventSeverity.MEDIUM,
      message: `Authentication failed for user ${userId}: ${reason}`,
      userId,
      ip,
      userAgent,
      outcome: 'failure',
      details: {
        failureReason: reason,
        ...metadata
      }
    });
  }

  /**
   * Log authorization failure
   */
  logAuthorizationFailure(
    userId: string,
    resource: string,
    action: string,
    ip: string,
    metadata?: Record<string, any>
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.AUTHORIZATION_FAILURE,
      severity: SecurityEventSeverity.MEDIUM,
      message: `User ${userId} denied access to ${resource} for action ${action}`,
      userId,
      resource,
      action,
      ip,
      outcome: 'failure',
      details: {
        deniedAction: action,
        deniedResource: resource,
        ...metadata
      }
    });
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(
    description: string,
    ip: string,
    userAgent: string,
    severity: SecurityEventSeverity = SecurityEventSeverity.HIGH,
    metadata?: Record<string, any>
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity,
      message: `Suspicious activity detected: ${description}`,
      ip,
      userAgent,
      outcome: 'blocked',
      details: {
        activityDescription: description,
        ...metadata
      }
    });
  }

  /**
   * Log SQL injection attempt
   */
  logSQLInjectionAttempt(
    ip: string,
    userAgent: string,
    payload: string,
    endpoint: string,
    metadata?: Record<string, any>
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.SQL_INJECTION_ATTEMPT,
      severity: SecurityEventSeverity.HIGH,
      message: 'SQL injection attempt detected',
      ip,
      userAgent,
      resource: endpoint,
      outcome: 'blocked',
      details: {
        payload: payload.substring(0, 500), // Truncate for safety
        endpoint,
        ...metadata
      }
    });
  }

  /**
   * Log XSS attempt
   */
  logXSSAttempt(
    ip: string,
    userAgent: string,
    payload: string,
    endpoint: string,
    metadata?: Record<string, any>
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.XSS_ATTEMPT,
      severity: SecurityEventSeverity.HIGH,
      message: 'XSS attempt detected',
      ip,
      userAgent,
      resource: endpoint,
      outcome: 'blocked',
      details: {
        payload: payload.substring(0, 500), // Truncate for safety
        endpoint,
        ...metadata
      }
    });
  }

  /**
   * Log rate limit exceeded
   */
  logRateLimitExceeded(
    ip: string,
    userAgent: string,
    endpoint: string,
    requestCount: number,
    timeWindow: number,
    metadata?: Record<string, any>
  ): void {
    this.logSecurityEvent({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecurityEventSeverity.MEDIUM,
      message: `Rate limit exceeded for endpoint ${endpoint}`,
      ip,
      userAgent,
      resource: endpoint,
      outcome: 'blocked',
      details: {
        requestCount,
        timeWindow,
        requestsPerSecond: requestCount / (timeWindow / 1000),
        ...metadata
      }
    });
  }

  /**
   * Log data access event
   */
  logDataAccess(event: Omit<DataAccessEvent, 'timestamp' | 'correlationId'>): void {
    const dataAccessEvent: DataAccessEvent = {
      ...event,
      timestamp: new Date(),
      correlationId: correlationManager.getCurrentCorrelationId()
    };

    // Determine severity based on data sensitivity
    let severity = SecurityEventSeverity.LOW;
    if (event.piiData || event.sensitiveData) {
      severity = SecurityEventSeverity.MEDIUM;
    }
    if (event.operation === 'delete' && event.recordCount && event.recordCount > 100) {
      severity = SecurityEventSeverity.HIGH;
    }

    this.logSecurityEvent({
      type: SecurityEventType.DATA_EXPORT,
      severity,
      message: `Data ${event.operation} operation on ${event.dataType}`,
      userId: event.userId,
      outcome: 'success',
      details: {
        ...dataAccessEvent,
        dataOperation: true
      }
    });

    // Also log to audit logger for compliance
    this.logAuditEvent({
      eventType: 'data_access',
      actor: {
        userId: event.userId
      },
      resource: {
        type: event.dataType,
        attributes: {
          recordCount: event.recordCount,
          sensitive: event.sensitiveData,
          pii: event.piiData
        }
      },
      action: event.operation,
      outcome: 'success',
      timestamp: dataAccessEvent.timestamp,
      correlationId: dataAccessEvent.correlationId,
      metadata: event.metadata
    });
  }

  /**
   * Log audit event for compliance
   */
  logAuditEvent(event: Omit<AuditEvent, 'timestamp' | 'correlationId'>): void {
    const auditEvent: AuditEvent = {
      ...event,
      timestamp: new Date(),
      correlationId: correlationManager.getCurrentCorrelationId()
    };

    this.auditLogger.info(`Audit Event: ${auditEvent.eventType} - ${auditEvent.action}`, {
      ...auditEvent,
      auditEvent: true
    });

    // Also log to main logger for visibility
    logger.info(`Audit Event: ${auditEvent.eventType} - ${auditEvent.action}`, {
      ...auditEvent,
      category: 'audit'
    });
  }

  /**
   * Calculate risk score for security event
   */
  private calculateRiskScore(event: SecurityEvent): RiskScore {
    const cacheKey = `${event.type}-${event.ip}-${event.userId}`;
    const cached = this.riskScoreCache.get(cacheKey);
    
    if (cached && Date.now() - cached.score < 300000) { // 5 minutes cache
      return cached;
    }

    let score = 0;
    const factors: string[] = [];

    // Base score by event type
    switch (event.type) {
      case SecurityEventType.AUTHENTICATION_FAILURE:
        score += 20;
        factors.push('auth_failure');
        break;
      case SecurityEventType.AUTHORIZATION_FAILURE:
        score += 15;
        factors.push('authz_failure');
        break;
      case SecurityEventType.SQL_INJECTION_ATTEMPT:
      case SecurityEventType.XSS_ATTEMPT:
        score += 80;
        factors.push('injection_attack');
        break;
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
        score += 50;
        factors.push('suspicious_activity');
        break;
      case SecurityEventType.RATE_LIMIT_EXCEEDED:
        score += 30;
        factors.push('rate_limit');
        break;
      default:
        score += 10;
    }

    // Increase score for repeated events from same IP
    const ipKey = `ip-${event.ip}`;
    const ipCounter = this.eventCounters.get(ipKey);
    if (ipCounter && ipCounter.count > 5) {
      score += Math.min(ipCounter.count * 5, 30);
      factors.push('repeated_ip');
    }

    // Increase score for failed outcomes
    if (event.outcome === 'failure') {
      score += 10;
      factors.push('failure_outcome');
    }

    // Increase score for privileged operations
    if (event.action && ['admin', 'delete', 'export'].some(op => event.action!.includes(op))) {
      score += 15;
      factors.push('privileged_operation');
    }

    // Geographic risk (simplified - in reality would use GeoIP)
    // This is a placeholder for actual geographic risk assessment
    if (event.ip && event.ip.startsWith('192.168.')) {
      // Internal IP - lower risk
      score -= 5;
      factors.push('internal_ip');
    }

    // Determine severity based on score
    let severity: SecurityEventSeverity;
    if (score >= 80) {
      severity = SecurityEventSeverity.CRITICAL;
    } else if (score >= 50) {
      severity = SecurityEventSeverity.HIGH;
    } else if (score >= 20) {
      severity = SecurityEventSeverity.MEDIUM;
    } else {
      severity = SecurityEventSeverity.LOW;
    }

    const riskScore: RiskScore = {
      score: Math.min(score, 100),
      factors,
      severity
    };

    // Cache the result
    this.riskScoreCache.set(cacheKey, riskScore);

    return riskScore;
  }

  /**
   * Update event counters for pattern analysis
   */
  private updateEventCounters(event: SecurityEvent): void {
    const now = new Date();
    
    // Count by IP
    if (event.ip) {
      const ipKey = `ip-${event.ip}`;
      const ipCounter = this.eventCounters.get(ipKey);
      if (ipCounter) {
        ipCounter.count++;
        ipCounter.lastSeen = now;
      } else {
        this.eventCounters.set(ipKey, { count: 1, lastSeen: now });
      }
    }

    // Count by user
    if (event.userId) {
      const userKey = `user-${event.userId}`;
      const userCounter = this.eventCounters.get(userKey);
      if (userCounter) {
        userCounter.count++;
        userCounter.lastSeen = now;
      } else {
        this.eventCounters.set(userKey, { count: 1, lastSeen: now });
      }
    }

    // Count by event type
    const typeKey = `type-${event.type}`;
    const typeCounter = this.eventCounters.get(typeKey);
    if (typeCounter) {
      typeCounter.count++;
      typeCounter.lastSeen = now;
    } else {
      this.eventCounters.set(typeKey, { count: 1, lastSeen: now });
    }

    // Clean up old counters (older than 1 hour)
    const hourAgo = new Date(Date.now() - 3600000);
    for (const [key, counter] of this.eventCounters) {
      if (counter.lastSeen < hourAgo) {
        this.eventCounters.delete(key);
      }
    }
  }

  /**
   * Analyze attack patterns
   */
  private analyzeAttackPatterns(event: SecurityEvent): void {
    if (!event.ip) return;

    const ipKey = `ip-${event.ip}`;
    const counter = this.eventCounters.get(ipKey);
    
    if (counter && counter.count > 10) {
      // Potential ongoing attack from this IP
      this.logSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: SecurityEventSeverity.CRITICAL,
        message: `Potential ongoing attack detected from IP ${event.ip}`,
        ip: event.ip,
        outcome: 'blocked',
        details: {
          eventCount: counter.count,
          pattern: 'repeated_events',
          timeWindow: '1 hour'
        }
      });
    }
  }

  /**
   * Determine if alert should be sent
   */
  private shouldAlert(event: SecurityEvent): boolean {
    if (!this.config.alertingEnabled) return false;

    // Always alert on critical events
    if (event.severity === SecurityEventSeverity.CRITICAL) return true;

    // Alert on high severity events in production
    if (event.severity === SecurityEventSeverity.HIGH && process.env.NODE_ENV === 'production') {
      return true;
    }

    // Alert on specific event types
    const alertEventTypes = [
      SecurityEventType.SQL_INJECTION_ATTEMPT,
      SecurityEventType.XSS_ATTEMPT,
      SecurityEventType.CSRF_ATTEMPT,
      SecurityEventType.PRIVILEGE_ESCALATION
    ];

    return alertEventTypes.includes(event.type);
  }

  /**
   * Send security alert
   */
  private sendSecurityAlert(event: SecurityEvent, riskScore: RiskScore): void {
    // In production, this would integrate with alerting systems
    // like PagerDuty, Slack, email, SMS, etc.
    
    const alertData = {
      event,
      riskScore,
      timestamp: new Date().toISOString(),
      service: 'learning-assistant',
      environment: process.env.NODE_ENV
    };

    // Log the alert
    logger.error('SECURITY ALERT', {
      ...alertData,
      category: 'security',
      alert: true
    });

    // In a real implementation, you would send to your alerting service
    if (this.config.realTimeAlerting) {
      // Example: Send to webhook, Slack, PagerDuty, etc.
      this.sendToAlertingService(alertData);
    }
  }

  /**
   * Send to external alerting service
   */
  private async sendToAlertingService(alertData: any): Promise<void> {
    // Implementation would depend on your alerting service
    // Examples: Webhook, Slack API, PagerDuty API, etc.
    
    try {
      const webhookUrl = process.env.SECURITY_ALERT_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SECURITY_ALERT_WEBHOOK_TOKEN || ''}`
          },
          body: JSON.stringify(alertData)
        });
      }
    } catch (error) {
      logger.error('Failed to send security alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category: 'security'
      });
    }
  }

  /**
   * Get log level based on severity
   */
  private getLogLevel(severity: SecurityEventSeverity): string {
    switch (severity) {
      case SecurityEventSeverity.LOW:
        return 'info';
      case SecurityEventSeverity.MEDIUM:
        return 'warn';
      case SecurityEventSeverity.HIGH:
      case SecurityEventSeverity.CRITICAL:
        return 'error';
      default:
        return 'warn';
    }
  }

  /**
   * Get security statistics
   */
  getStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [key, counter] of this.eventCounters) {
      stats[key] = {
        count: counter.count,
        lastSeen: counter.lastSeen
      };
    }

    return {
      enabled: this.config.enabled,
      eventCounters: stats,
      cacheSize: this.riskScoreCache.size,
      config: this.config
    };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.eventCounters.clear();
    this.riskScoreCache.clear();
  }

  /**
   * Shutdown security logger
   */
  shutdown(): void {
    this.reset();
    
    // Close loggers
    if (this.securityLogger) {
      this.securityLogger.transports.forEach(transport => {
        if (transport.close) transport.close();
      });
    }
    
    if (this.auditLogger) {
      this.auditLogger.transports.forEach(transport => {
        if (transport.close) transport.close();
      });
    }
  }
}

// Create default instance
export const securityAuditLogger = new SecurityAuditLogger();

// Export factory function
export function createSecurityAuditLogger(config: Partial<SecurityLoggerConfig> = {}): SecurityAuditLogger {
  return new SecurityAuditLogger(config);
}

// Export types for external use
export { SecurityEventType, SecurityEventSeverity };

export default securityAuditLogger;