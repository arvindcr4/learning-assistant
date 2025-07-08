/**
 * Log Formatting and Utility Functions
 * 
 * Provides utilities for:
 * - Structured log formatting
 * - Sensitive data scrubbing
 * - Log sampling
 * - Log buffering
 * - Data sanitization
 */

import winston from 'winston';
import { LogContext, LogFormatterOptions, LogSamplingOptions, LogBufferOptions } from '../types';

// Sensitive field patterns
const SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /token/i,
  /secret/i,
  /key/i,
  /auth/i,
  /credential/i,
  /cookie/i,
  /session/i,
  /bearer/i,
  /api[_-]?key/i,
  /access[_-]?key/i,
  /private[_-]?key/i,
  /client[_-]?secret/i,
  /refresh[_-]?token/i,
  /ssn/i,
  /social[_-]?security/i,
  /credit[_-]?card/i,
  /card[_-]?number/i,
  /cvv/i,
  /pin/i,
  /bank[_-]?account/i,
  /routing[_-]?number/i
];

// Common credit card patterns
const CREDIT_CARD_PATTERNS = [
  /\b4[0-9]{12}(?:[0-9]{3})?\b/, // Visa
  /\b5[1-5][0-9]{14}\b/, // MasterCard
  /\b3[47][0-9]{13}\b/, // American Express
  /\b6(?:011|5[0-9]{2})[0-9]{12}\b/ // Discover
];

// Email pattern
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Phone number patterns
const PHONE_PATTERNS = [
  /\b\d{3}-\d{3}-\d{4}\b/g, // XXX-XXX-XXXX
  /\b\(\d{3}\)\s?\d{3}-\d{4}\b/g, // (XXX) XXX-XXXX
  /\b\d{3}\.\d{3}\.\d{4}\b/g, // XXX.XXX.XXXX
  /\b\+1\s?\d{3}\s?\d{3}\s?\d{4}\b/g // +1 XXX XXX XXXX
];

// SSN pattern
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

/**
 * Enhanced log formatter with comprehensive formatting options
 */
export class LogFormatter {
  private options: LogFormatterOptions;

  constructor(options: LogFormatterOptions = {}) {
    this.options = {
      timestamp: true,
      level: true,
      message: true,
      meta: true,
      colorize: false,
      json: true,
      prettyPrint: false,
      depth: 3,
      sanitize: true,
      maskSensitive: true,
      ...options
    };
  }

  /**
   * Create Winston formatter
   */
  createFormatter(): winston.Logform.Format {
    return winston.format.combine(
      ...[
        this.options.timestamp && winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }),
        winston.format.errors({ stack: true }),
        winston.format.printf((info) => this.formatLogEntry(info))
      ].filter(Boolean)
    );
  }

  /**
   * Format individual log entry
   */
  private formatLogEntry(info: any): string {
    const { timestamp, level, message, ...meta } = info;

    // Create base log object
    const logEntry: any = {};

    if (this.options.timestamp && timestamp) {
      logEntry.timestamp = timestamp;
    }

    if (this.options.level) {
      logEntry.level = level;
    }

    if (this.options.message) {
      logEntry.message = this.options.sanitize ? this.sanitizeMessage(message) : message;
    }

    if (this.options.meta && Object.keys(meta).length > 0) {
      const processedMeta = this.options.sanitize ? this.sanitizeObject(meta) : meta;
      Object.assign(logEntry, processedMeta);
    }

    // Return formatted string
    if (this.options.json) {
      return JSON.stringify(logEntry, null, this.options.prettyPrint ? 2 : 0);
    } else {
      return this.formatAsText(logEntry);
    }
  }

  /**
   * Format as human-readable text
   */
  private formatAsText(logEntry: any): string {
    const { timestamp, level, message, ...meta } = logEntry;
    let text = '';

    if (timestamp) text += `[${timestamp}] `;
    if (level) text += `${level.toUpperCase()} `;
    if (message) text += message;
    
    if (Object.keys(meta).length > 0) {
      text += ` ${JSON.stringify(meta)}`;
    }

    return text;
  }

  /**
   * Sanitize message content
   */
  private sanitizeMessage(message: string): string {
    if (!this.options.maskSensitive) return message;

    let sanitized = message;

    // Mask credit card numbers
    CREDIT_CARD_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, (match) => {
        return `****-****-****-${match.slice(-4)}`;
      });
    });

    // Mask emails
    sanitized = sanitized.replace(EMAIL_PATTERN, (match) => {
      const [username, domain] = match.split('@');
      return `${username.slice(0, 2)}***@${domain}`;
    });

    // Mask phone numbers
    PHONE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '***-***-****');
    });

    // Mask SSNs
    sanitized = sanitized.replace(SSN_PATTERN, '***-**-****');

    return sanitized;
  }

  /**
   * Sanitize object recursively
   */
  private sanitizeObject(obj: any, depth: number = 0): any {
    if (depth > (this.options.depth || 3)) {
      return '[Max Depth Reached]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeMessage(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (obj instanceof Date) {
      return obj.toISOString();
    }

    if (obj instanceof Error) {
      return {
        name: obj.name,
        message: this.sanitizeMessage(obj.message),
        stack: obj.stack
      };
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (this.isSensitiveField(key)) {
          sanitized[key] = this.options.maskSensitive ? '[REDACTED]' : value;
        } else {
          sanitized[key] = this.sanitizeObject(value, depth + 1);
        }
      }
      
      return sanitized;
    }

    return obj;
  }

  /**
   * Check if field name indicates sensitive data
   */
  private isSensitiveField(fieldName: string): boolean {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldName));
  }
}

/**
 * Sensitive data scrubber
 */
export function sensitiveDataScrubber(data: any, customFields: string[] = []): any {
  const formatter = new LogFormatter({
    sanitize: true,
    maskSensitive: true
  });

  // Add custom sensitive fields
  const allSensitiveFields = [...customFields];
  
  return formatter['sanitizeObject'](data);
}

/**
 * Log sampler for high-volume logging
 */
export class LogSampler {
  private options: LogSamplingOptions;
  private counters: Map<string, number> = new Map();

  constructor(options: LogSamplingOptions) {
    this.options = options;
  }

  /**
   * Determine if log should be sampled
   */
  shouldSample(level: string, category?: string): boolean {
    if (!this.options.enabled) return false;

    // Never sample important logs
    if (this.options.preserveErrors && level === 'error') return false;
    if (this.options.preserveWarnings && level === 'warn') return false;
    if (this.options.preserveSecurity && category === 'security') return false;

    // Apply sampling rate
    return Math.random() > this.options.rate;
  }

  /**
   * Get sampling statistics
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [key, count] of this.counters) {
      stats[key] = count;
    }

    return {
      enabled: this.options.enabled,
      rate: this.options.rate,
      counters: stats
    };
  }

  /**
   * Reset sampling counters
   */
  reset(): void {
    this.counters.clear();
  }
}

/**
 * Log buffer for batching and performance
 */
export class LogBuffer {
  private options: LogBufferOptions;
  private buffer: any[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private flushCallback: (logs: any[]) => void;

  constructor(options: LogBufferOptions, flushCallback: (logs: any[]) => void) {
    this.options = options;
    this.flushCallback = flushCallback;

    if (this.options.enabled) {
      this.startFlushTimer();
    }

    // Setup exit handlers
    if (this.options.flushOnExit) {
      process.on('exit', () => this.flush());
      process.on('SIGINT', () => {
        this.flush();
        process.exit(0);
      });
      process.on('SIGTERM', () => {
        this.flush();
        process.exit(0);
      });
    }
  }

  /**
   * Add log entry to buffer
   */
  add(logEntry: any): void {
    if (!this.options.enabled) {
      this.flushCallback([logEntry]);
      return;
    }

    this.buffer.push(logEntry);

    // Flush immediately on error if configured
    if (this.options.flushOnError && logEntry.level === 'error') {
      this.flush();
      return;
    }

    // Flush if buffer is full
    if (this.buffer.length >= this.options.size) {
      this.flush();
    }
  }

  /**
   * Flush buffer contents
   */
  flush(): void {
    if (this.buffer.length === 0) return;

    const logs = [...this.buffer];
    this.buffer = [];

    try {
      this.flushCallback(logs);
    } catch (error) {
      console.error('Error flushing log buffer:', error);
      // Re-add logs to buffer on error
      this.buffer.unshift(...logs);
    }
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.options.flushInterval);
  }

  /**
   * Stop buffer and flush remaining logs
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    this.flush();
  }

  /**
   * Get buffer statistics
   */
  getStats(): Record<string, any> {
    return {
      enabled: this.options.enabled,
      currentSize: this.buffer.length,
      maxSize: this.options.size,
      flushInterval: this.options.flushInterval
    };
  }
}

/**
 * Utility functions for log formatting
 */
export const formatUtils = {
  /**
   * Format bytes to human readable string
   */
  formatBytes: (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  },

  /**
   * Format duration to human readable string
   */
  formatDuration: (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
    return `${(ms / 3600000).toFixed(2)}h`;
  },

  /**
   * Truncate string to specified length
   */
  truncate: (str: string, length: number): string => {
    if (str.length <= length) return str;
    return str.substring(0, length - 3) + '...';
  },

  /**
   * Deep clone object
   */
  deepClone: (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) return obj.map(item => formatUtils.deepClone(item));
    
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = formatUtils.deepClone(obj[key]);
      }
    }
    return cloned;
  }
};

// Export default formatter instance
export const logFormatter = new LogFormatter();

// Export default sampler instance
export const logSampler = new LogSampler({
  enabled: process.env.LOG_SAMPLING_ENABLED === 'true',
  rate: parseFloat(process.env.LOG_SAMPLING_RATE || '0.1'),
  preserveErrors: true,
  preserveWarnings: true,
  preserveSecurity: true
});

// Export buffer factory function
export function createLogBuffer(
  options: LogBufferOptions,
  flushCallback: (logs: any[]) => void
): LogBuffer {
  return new LogBuffer(options, flushCallback);
}

// Default log buffer instance
export const logBuffer = createLogBuffer(
  {
    enabled: process.env.LOG_BUFFERING_ENABLED === 'true',
    size: parseInt(process.env.LOG_BUFFER_SIZE || '1000'),
    flushInterval: parseInt(process.env.LOG_FLUSH_INTERVAL || '5000'),
    flushOnError: true,
    flushOnExit: true
  },
  (logs) => {
    // Default flush callback - this would be overridden by the logger
    console.log(`Flushing ${logs.length} buffered logs`);
  }
);