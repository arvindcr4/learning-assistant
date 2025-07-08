/**
 * Centralized Logging System Types
 * 
 * Type definitions for the logging infrastructure
 */

import { Transport } from 'winston';

// Log levels
export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

// Base log context interface
export interface LogContext {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  category?: string;
  operation?: string;
  component?: string;
  version?: string;
  environment?: string;
  timestamp?: string;
  [key: string]: any;
}

// Log entry structure
export interface LogEntry {
  level: LogLevel;
  message: string;
  context: LogContext;
  timestamp: Date;
  metadata?: Record<string, any>;
  stack?: string;
  tags?: string[];
}

// Performance metric structure
export interface PerformanceMetric {
  operation: string;
  duration: number;
  unit: 'ms' | 's' | 'min';
  success: boolean;
  timestamp: Date;
  context: LogContext;
  metadata?: {
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    networkLatency?: number;
    cacheHitRate?: number;
    queryCount?: number;
    [key: string]: any;
  };
}

// Security event types
export enum SecurityEventType {
  AUTHENTICATION_SUCCESS = 'AUTH_SUCCESS',
  AUTHENTICATION_FAILURE = 'AUTH_FAILURE',
  AUTHORIZATION_FAILURE = 'AUTHZ_FAILURE',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_DESTROYED = 'SESSION_DESTROYED',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_INPUT = 'INVALID_INPUT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  CSRF_ATTEMPT = 'CSRF_ATTEMPT',
  FILE_UPLOAD_REJECTED = 'FILE_UPLOAD_REJECTED',
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_IMPORT = 'DATA_IMPORT',
  DATA_DELETION = 'DATA_DELETION',
  CONFIGURATION_CHANGE = 'CONFIG_CHANGE',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  SECURITY_SCAN_DETECTED = 'SECURITY_SCAN_DETECTED',
  COMPLIANCE_VIOLATION = 'COMPLIANCE_VIOLATION',
  PRIVACY_BREACH = 'PRIVACY_BREACH'
}

// Security event severity levels
export enum SecurityEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Security event structure
export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  message: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  outcome?: 'success' | 'failure' | 'blocked' | 'pending';
  riskScore?: number;
  details?: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp: Date;
  correlationId?: string;
}

// Audit event structure
export interface AuditEvent {
  eventType: string;
  actor: {
    userId?: string;
    username?: string;
    role?: string;
    ip?: string;
    userAgent?: string;
  };
  resource: {
    type: string;
    id?: string;
    name?: string;
    attributes?: Record<string, any>;
  };
  action: string;
  outcome: 'success' | 'failure' | 'partial';
  timestamp: Date;
  correlationId?: string;
  metadata?: Record<string, any>;
  complianceFlags?: string[];
}

// Data access event structure
export interface DataAccessEvent {
  operation: 'read' | 'write' | 'delete' | 'export' | 'import';
  dataType: string;
  recordCount?: number;
  sensitiveData?: boolean;
  piiData?: boolean;
  userId?: string;
  justification?: string;
  timestamp: Date;
  correlationId?: string;
  metadata?: Record<string, any>;
}

// Log transport configuration
export interface LogTransport {
  name: string;
  transport: Transport;
  enabled: boolean;
  level: LogLevel;
  config: Record<string, any>;
  healthCheck?: () => Promise<boolean>;
}

// Logger configuration
export interface LoggerConfig {
  level: LogLevel;
  format: string;
  transports: LogTransport[];
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  enableSampling: boolean;
  samplingRate: number;
  enableBuffering: boolean;
  bufferSize: number;
  flushInterval: number;
  enableScrubbing: boolean;
  scrubFields: string[];
  enableMetrics: boolean;
  enableAudit: boolean;
  enableCompliance: boolean;
  retention: {
    local: number; // days
    remote: number; // days
    archive: number; // days
  };
  rotation: {
    enabled: boolean;
    maxSize: string;
    maxFiles: number;
    datePattern: string;
  };
}

// Log formatter options
export interface LogFormatterOptions {
  timestamp?: boolean;
  level?: boolean;
  message?: boolean;
  meta?: boolean;
  colorize?: boolean;
  json?: boolean;
  prettyPrint?: boolean;
  depth?: number;
  sanitize?: boolean;
  maskSensitive?: boolean;
}

// Log sampling options
export interface LogSamplingOptions {
  enabled: boolean;
  rate: number; // 0.0 to 1.0
  preserveErrors: boolean;
  preserveWarnings: boolean;
  preserveSecurity: boolean;
}

// Log buffer options
export interface LogBufferOptions {
  enabled: boolean;
  size: number;
  flushInterval: number; // milliseconds
  flushOnError: boolean;
  flushOnExit: boolean;
}

// Log aggregation options
export interface LogAggregationOptions {
  enabled: boolean;
  services: ('elasticsearch' | 'datadog' | 'splunk' | 'logzio' | 'newrelic' | 'custom')[];
  batchSize: number;
  flushInterval: number;
  retryAttempts: number;
  compression: boolean;
}

// Monitoring thresholds
export interface MonitoringThresholds {
  errorRate: number; // errors per minute
  warningRate: number; // warnings per minute
  logVolume: number; // MB per hour
  diskUsage: number; // percentage
  memoryUsage: number; // percentage
  responseTime: number; // milliseconds
}

// Health check result
export interface HealthCheckResult {
  service: string;
  healthy: boolean;
  lastCheck: Date;
  error?: string;
  metrics?: Record<string, any>;
}

// Log statistics
export interface LogStatistics {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  debugCount: number;
  logRate: number; // logs per minute
  averageLogSize: number; // bytes
  diskUsage: number; // bytes
  oldestLog: Date;
  newestLog: Date;
}

// Compliance context
export interface ComplianceContext {
  regulation: 'GDPR' | 'CCPA' | 'HIPAA' | 'SOX' | 'PCI-DSS' | 'CUSTOM';
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  retentionPeriod: number; // days
  encryptionRequired: boolean;
  accessControlRequired: boolean;
  auditRequired: boolean;
  anonymizationRequired: boolean;
}

// Error context for logging
export interface ErrorContext {
  error: Error;
  context: LogContext;
  stackTrace?: string;
  userAction?: string;
  systemState?: Record<string, any>;
  recovery?: string;
  impact?: 'low' | 'medium' | 'high' | 'critical';
}

// Business event context
export interface BusinessEventContext {
  eventName: string;
  eventType: 'user_action' | 'system_event' | 'business_process' | 'integration';
  userId?: string;
  sessionId?: string;
  entityId?: string;
  entityType?: string;
  properties?: Record<string, any>;
  value?: number;
  currency?: string;
  timestamp: Date;
  correlationId?: string;
}

// System metric context
export interface SystemMetricContext {
  metricName: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
  dimensions?: Record<string, any>;
  threshold?: {
    warning: number;
    critical: number;
  };
}

// Log query interface
export interface LogQuery {
  level?: LogLevel[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  correlationId?: string;
  userId?: string;
  component?: string;
  category?: string;
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'level' | 'message';
  sortOrder?: 'asc' | 'desc';
}

// Log search result
export interface LogSearchResult {
  entries: LogEntry[];
  totalCount: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  aggregations?: Record<string, any>;
}

// Request logging context
export interface RequestLogContext extends LogContext {
  requestId?: string;
  route?: string;
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  responseSize?: number;
  requestSize?: number;
  cacheHit?: boolean;
  authenticationMethod?: string;
  clientType?: string;
  clientVersion?: string;
  geoLocation?: {
    country?: string;
    region?: string;
    city?: string;
  };
}