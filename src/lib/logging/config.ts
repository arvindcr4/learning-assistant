/**
 * Logging System Configuration
 * 
 * Centralized configuration for the entire logging infrastructure:
 * - Environment-specific settings
 * - Transport configurations
 * - Performance thresholds
 * - Security settings
 * - Integration configurations
 */

import { LogLevel, LoggerConfig } from './types';

// Environment detection
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_DEVELOPMENT = NODE_ENV === 'development';
export const IS_TEST = NODE_ENV === 'test';
export const IS_STAGING = NODE_ENV === 'staging';
export const IS_PRODUCTION = NODE_ENV === 'production';

// Base logging configuration
export const LOGGING_CONFIG = {
  // Core settings
  enabled: process.env.LOGGING_ENABLED !== 'false',
  level: (process.env.LOG_LEVEL as LogLevel) || (IS_DEVELOPMENT ? 'debug' : 'info'),
  
  // Output settings
  enableConsole: true,
  enableFile: IS_PRODUCTION || IS_STAGING,
  enableRemote: IS_PRODUCTION,
  
  // Format settings
  enableJson: IS_PRODUCTION || IS_STAGING,
  enableTimestamp: true,
  enableColors: IS_DEVELOPMENT,
  
  // Security settings
  enableScrubbing: true,
  maskSensitiveData: true,
  sanitizeUrls: true,
  
  // Performance settings
  enableSampling: IS_PRODUCTION,
  samplingRate: parseFloat(process.env.LOG_SAMPLING_RATE || '0.1'),
  enableBuffering: IS_PRODUCTION,
  bufferSize: parseInt(process.env.LOG_BUFFER_SIZE || '1000'),
  flushInterval: parseInt(process.env.LOG_FLUSH_INTERVAL || '5000'),
  
  // Features
  enableMetrics: true,
  enablePerformance: true,
  enableSecurity: true,
  enableAudit: IS_PRODUCTION || IS_STAGING,
  enableCompliance: IS_PRODUCTION,
  enableCorrelation: true,
  
  // File rotation
  rotation: {
    enabled: true,
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || (IS_PRODUCTION ? '90' : '7')),
    datePattern: 'YYYY-MM-DD',
    compress: true
  },
  
  // Retention policies (in days)
  retention: {
    application: IS_PRODUCTION ? 30 : 7,
    error: IS_PRODUCTION ? 90 : 14,
    security: IS_PRODUCTION ? 2555 : 30, // 7 years for compliance
    audit: IS_PRODUCTION ? 2555 : 30,
    performance: IS_PRODUCTION ? 14 : 7,
    business: IS_PRODUCTION ? 365 : 30
  }
} as const;

// Performance monitoring thresholds
export const PERFORMANCE_THRESHOLDS = {
  responseTime: {
    warn: parseInt(process.env.PERF_RESPONSE_WARN || '1000'), // 1 second
    critical: parseInt(process.env.PERF_RESPONSE_CRITICAL || '5000') // 5 seconds
  },
  databaseQuery: {
    warn: parseInt(process.env.PERF_DB_WARN || '500'), // 500ms
    critical: parseInt(process.env.PERF_DB_CRITICAL || '2000') // 2 seconds
  },
  memoryUsage: {
    warn: parseInt(process.env.PERF_MEMORY_WARN || '80'), // 80%
    critical: parseInt(process.env.PERF_MEMORY_CRITICAL || '95') // 95%
  },
  cpuUsage: {
    warn: parseInt(process.env.PERF_CPU_WARN || '80'), // 80%
    critical: parseInt(process.env.PERF_CPU_CRITICAL || '95') // 95%
  },
  diskUsage: {
    warn: parseInt(process.env.PERF_DISK_WARN || '85'), // 85%
    critical: parseInt(process.env.PERF_DISK_CRITICAL || '95') // 95%
  }
} as const;

// Security configuration
export const SECURITY_CONFIG = {
  enabled: LOGGING_CONFIG.enableSecurity,
  level: 'warn' as LogLevel,
  retentionDays: LOGGING_CONFIG.retention.security,
  encryptLogs: IS_PRODUCTION,
  alertingEnabled: IS_PRODUCTION,
  complianceMode: process.env.COMPLIANCE_MODE === 'true',
  sensitiveDataMasking: LOGGING_CONFIG.maskSensitiveData,
  realTimeAlerting: process.env.SECURITY_REAL_TIME_ALERTS === 'true',
  
  // Risk scoring
  riskScoring: {
    enabled: IS_PRODUCTION,
    cacheTtl: 300000, // 5 minutes
    thresholds: {
      low: 20,
      medium: 50,
      high: 80,
      critical: 95
    }
  },
  
  // Event monitoring
  monitoring: {
    enabled: IS_PRODUCTION,
    alertThresholds: {
      failedLogins: 5, // per IP per hour
      suspiciousActivity: 3, // per IP per hour
      securityEvents: 10 // per hour total
    }
  }
} as const;

// Request logging configuration
export const REQUEST_LOGGING_CONFIG = {
  enabled: true,
  includeRequestBody: IS_DEVELOPMENT,
  includeResponseBody: false,
  includeHeaders: true,
  maxBodySize: 10240, // 10KB
  logLevel: IS_DEVELOPMENT ? 'debug' as LogLevel : 'info' as LogLevel,
  
  // Security settings
  sensitiveHeaders: [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
    'x-refresh-token'
  ],
  
  // Paths to ignore
  ignorePaths: [
    '/health',
    '/metrics',
    '/favicon.ico',
    '/_next',
    '/_vercel',
    '/api/health'
  ],
  
  // Performance monitoring
  enablePerformanceMetrics: true,
  enableSecurityLogging: true,
  slowRequestThreshold: parseInt(process.env.SLOW_REQUEST_THRESHOLD || '5000') // 5 seconds
} as const;

// External service configurations
export const EXTERNAL_SERVICES = {
  // Sentry
  sentry: {
    enabled: IS_PRODUCTION && !!process.env.SENTRY_DSN,
    dsn: process.env.SENTRY_DSN,
    environment: NODE_ENV,
    release: process.env.npm_package_version || process.env.VERCEL_GIT_COMMIT_SHA,
    sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0'),
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    enablePerformanceMonitoring: true,
    enableSecurityLogging: true,
    captureConsole: !IS_DEVELOPMENT,
    captureUnhandledRejections: true
  },
  
  // LogZ.io
  logzio: {
    enabled: !!process.env.LOGZIO_TOKEN,
    token: process.env.LOGZIO_TOKEN,
    host: process.env.LOGZIO_HOST || 'listener.logz.io',
    type: 'nodejs',
    level: 'info' as LogLevel
  },
  
  // Loggly
  loggly: {
    enabled: !!(process.env.LOGGLY_TOKEN && process.env.LOGGLY_SUBDOMAIN),
    token: process.env.LOGGLY_TOKEN,
    subdomain: process.env.LOGGLY_SUBDOMAIN,
    tags: ['learning-assistant', NODE_ENV],
    level: 'info' as LogLevel
  },
  
  // Elasticsearch
  elasticsearch: {
    enabled: !!process.env.ELASTICSEARCH_URL,
    url: process.env.ELASTICSEARCH_URL,
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
    index: process.env.ELASTICSEARCH_INDEX || 'learning-assistant-logs',
    level: 'info' as LogLevel,
    sslVerify: process.env.ELASTICSEARCH_SSL_VERIFY !== 'false'
  },
  
  // DataDog
  datadog: {
    enabled: !!process.env.DATADOG_API_KEY,
    apiKey: process.env.DATADOG_API_KEY,
    appKey: process.env.DATADOG_APP_KEY,
    hostname: process.env.DATADOG_HOSTNAME || 'learning-assistant',
    service: 'learning-assistant',
    tags: [`env:${NODE_ENV}`, 'service:learning-assistant'],
    level: 'info' as LogLevel
  },
  
  // Splunk
  splunk: {
    enabled: !!(process.env.SPLUNK_TOKEN && process.env.SPLUNK_URL),
    token: process.env.SPLUNK_TOKEN,
    url: process.env.SPLUNK_URL,
    level: 'info' as LogLevel
  },
  
  // New Relic
  newrelic: {
    enabled: !!process.env.NEW_RELIC_LICENSE_KEY,
    licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
    level: 'info' as LogLevel
  },
  
  // Custom webhook
  webhook: {
    enabled: !!process.env.LOG_WEBHOOK_URL,
    url: process.env.LOG_WEBHOOK_URL,
    token: process.env.LOG_WEBHOOK_TOKEN,
    level: 'warn' as LogLevel
  }
} as const;

// Health check configuration
export const HEALTH_CHECK_CONFIG = {
  enabled: IS_PRODUCTION,
  interval: parseInt(process.env.LOG_HEALTH_CHECK_INTERVAL || '300000'), // 5 minutes
  timeout: parseInt(process.env.LOG_HEALTH_CHECK_TIMEOUT || '5000'), // 5 seconds
  
  // Services to check
  services: {
    coreLogger: true,
    performanceLogger: true,
    securityLogger: true,
    externalTransports: IS_PRODUCTION
  }
} as const;

// Metrics collection configuration
export const METRICS_CONFIG = {
  enabled: LOGGING_CONFIG.enableMetrics,
  interval: parseInt(process.env.LOG_METRICS_INTERVAL || '60000'), // 1 minute
  
  // System metrics
  system: {
    enabled: true,
    includeMemory: true,
    includeCpu: true,
    includeDisk: false, // Requires additional dependencies
    includeNetwork: false
  },
  
  // Application metrics
  application: {
    enabled: true,
    trackErrorRates: true,
    trackLogVolume: true,
    trackPerformance: true,
    trackSecurity: true
  },
  
  // Alerting thresholds
  alerting: {
    errorRate: parseInt(process.env.METRICS_ERROR_RATE_THRESHOLD || '10'), // errors per minute
    logVolume: parseInt(process.env.METRICS_LOG_VOLUME_THRESHOLD || '500'), // MB per hour
    diskUsage: parseInt(process.env.METRICS_DISK_USAGE_THRESHOLD || '85') // percentage
  }
} as const;

// Sensitive data patterns
export const SENSITIVE_DATA_PATTERNS = {
  fields: [
    'password',
    'passwd',
    'token',
    'secret',
    'key',
    'auth',
    'credential',
    'cookie',
    'session',
    'bearer',
    'api_key',
    'access_key',
    'private_key',
    'client_secret',
    'refresh_token',
    'ssn',
    'social_security',
    'credit_card',
    'card_number',
    'cvv',
    'pin',
    'bank_account',
    'routing_number'
  ],
  
  patterns: {
    creditCard: [
      /\b4[0-9]{12}(?:[0-9]{3})?\b/, // Visa
      /\b5[1-5][0-9]{14}\b/, // MasterCard
      /\b3[47][0-9]{13}\b/, // American Express
      /\b6(?:011|5[0-9]{2})[0-9]{12}\b/ // Discover
    ],
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: [
      /\b\d{3}-\d{3}-\d{4}\b/g, // XXX-XXX-XXXX
      /\b\(\d{3}\)\s?\d{3}-\d{4}\b/g, // (XXX) XXX-XXXX
      /\b\d{3}\.\d{3}\.\d{4}\b/g, // XXX.XXX.XXXX
      /\b\+1\s?\d{3}\s?\d{3}\s?\d{4}\b/g // +1 XXX XXX XXXX
    ],
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g
  }
} as const;

// Default logger configuration factory
export function createDefaultLoggerConfig(): LoggerConfig {
  return {
    level: LOGGING_CONFIG.level,
    format: LOGGING_CONFIG.enableJson ? 'json' : 'simple',
    transports: [],
    enableConsole: LOGGING_CONFIG.enableConsole,
    enableFile: LOGGING_CONFIG.enableFile,
    enableRemote: LOGGING_CONFIG.enableRemote,
    enableSampling: LOGGING_CONFIG.enableSampling,
    samplingRate: LOGGING_CONFIG.samplingRate,
    enableBuffering: LOGGING_CONFIG.enableBuffering,
    bufferSize: LOGGING_CONFIG.bufferSize,
    flushInterval: LOGGING_CONFIG.flushInterval,
    enableScrubbing: LOGGING_CONFIG.enableScrubbing,
    scrubFields: SENSITIVE_DATA_PATTERNS.fields,
    enableMetrics: LOGGING_CONFIG.enableMetrics,
    enableAudit: LOGGING_CONFIG.enableAudit,
    enableCompliance: LOGGING_CONFIG.enableCompliance,
    retention: LOGGING_CONFIG.retention,
    rotation: LOGGING_CONFIG.rotation
  };
}

// Environment-specific overrides
export function getEnvironmentConfig(): Partial<LoggerConfig> {
  const base = createDefaultLoggerConfig();
  
  switch (NODE_ENV) {
    case 'development':
      return {
        ...base,
        level: 'debug',
        enableFile: false,
        enableRemote: false,
        enableBuffering: false,
        enableSampling: false,
        enableCompliance: false
      };
      
    case 'test':
      return {
        ...base,
        level: 'error',
        enableConsole: false,
        enableFile: false,
        enableRemote: false,
        enableMetrics: false,
        enableAudit: false,
        enableCompliance: false
      };
      
    case 'staging':
      return {
        ...base,
        level: 'info',
        enableRemote: true,
        enableCompliance: true,
        retention: {
          application: 14,
          error: 30,
          security: 90,
          audit: 90,
          performance: 7,
          business: 30
        }
      };
      
    case 'production':
      return {
        ...base,
        level: 'info',
        enableRemote: true,
        enableBuffering: true,
        enableSampling: true,
        enableCompliance: true
      };
      
    default:
      return base;
  }
}

// Validate configuration
export function validateConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required environment variables for production
  if (IS_PRODUCTION) {
    if (!process.env.SENTRY_DSN && EXTERNAL_SERVICES.sentry.enabled) {
      errors.push('SENTRY_DSN is required for production logging');
    }
    
    if (EXTERNAL_SERVICES.elasticsearch.enabled && !EXTERNAL_SERVICES.elasticsearch.url) {
      errors.push('ELASTICSEARCH_URL is required when Elasticsearch is enabled');
    }
    
    if (EXTERNAL_SERVICES.datadog.enabled && !EXTERNAL_SERVICES.datadog.apiKey) {
      errors.push('DATADOG_API_KEY is required when DataDog is enabled');
    }
  }

  // Validate threshold values
  if (PERFORMANCE_THRESHOLDS.responseTime.warn >= PERFORMANCE_THRESHOLDS.responseTime.critical) {
    errors.push('Response time warning threshold must be less than critical threshold');
  }

  if (PERFORMANCE_THRESHOLDS.databaseQuery.warn >= PERFORMANCE_THRESHOLDS.databaseQuery.critical) {
    errors.push('Database query warning threshold must be less than critical threshold');
  }

  // Validate sampling rate
  if (LOGGING_CONFIG.samplingRate < 0 || LOGGING_CONFIG.samplingRate > 1) {
    errors.push('Sampling rate must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Export all configurations
export default {
  LOGGING_CONFIG,
  PERFORMANCE_THRESHOLDS,
  SECURITY_CONFIG,
  REQUEST_LOGGING_CONFIG,
  EXTERNAL_SERVICES,
  HEALTH_CHECK_CONFIG,
  METRICS_CONFIG,
  SENSITIVE_DATA_PATTERNS,
  createDefaultLoggerConfig,
  getEnvironmentConfig,
  validateConfiguration
};