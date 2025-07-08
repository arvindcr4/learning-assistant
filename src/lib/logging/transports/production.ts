/**
 * Production Log Transports
 * 
 * Production-ready log transports for:
 * - External log aggregation services
 * - Cloud logging providers
 * - Monitoring and alerting systems
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import WinstonLogzio from 'winston-logzio';
import { LogglyTransport } from 'winston-loggly-bulk';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import PapertrailTransport from 'winston-papertrail';
import WinstonSyslog from 'winston-syslog';
import { logFormatter } from '../utils/formatters';

// Environment flags
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Create production file transports with rotation
 */
function createFileTransports(): winston.transport[] {
  if (!isProduction) return [];

  const baseFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  return [
    // Application logs
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: baseFormat,
      level: 'info',
      auditFile: 'logs/.app-audit.json'
    }),

    // Error logs
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '90d',
      format: baseFormat,
      level: 'error',
      auditFile: 'logs/.error-audit.json'
    }),

    // Security logs (long retention)
    new DailyRotateFile({
      filename: 'logs/security-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '50m',
      maxFiles: '2555d', // 7 years for compliance
      format: baseFormat,
      level: 'warn',
      auditFile: 'logs/.security-audit.json',
      filter: (info) => info.category === 'security' || info.securityEvent === true
    }),

    // Performance logs
    new DailyRotateFile({
      filename: 'logs/performance-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '100m',
      maxFiles: '14d',
      format: baseFormat,
      level: 'info',
      auditFile: 'logs/.performance-audit.json',
      filter: (info) => info.category === 'performance' || info.performanceMetric === true
    }),

    // Audit logs (compliance)
    new DailyRotateFile({
      filename: 'logs/audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '100m',
      maxFiles: '2555d', // 7 years for compliance
      format: baseFormat,
      level: 'info',
      auditFile: 'logs/.audit-audit.json',
      filter: (info) => info.category === 'audit' || info.auditEvent === true
    }),

    // Business events
    new DailyRotateFile({
      filename: 'logs/business-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '50m',
      maxFiles: '365d', // 1 year
      format: baseFormat,
      level: 'info',
      auditFile: 'logs/.business-audit.json',
      filter: (info) => info.category === 'business' || info.businessEvent === true
    })
  ];
}

/**
 * Create LogZ.io transport
 */
function createLogzioTransport(): winston.transport | null {
  if (!process.env.LOGZIO_TOKEN) return null;

  return new WinstonLogzio({
    token: process.env.LOGZIO_TOKEN,
    host: process.env.LOGZIO_HOST || 'listener.logz.io',
    type: 'nodejs',
    level: 'info',
    extraFields: {
      service: 'learning-assistant',
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    }
  });
}

/**
 * Create Loggly transport
 */
function createLogglyTransport(): winston.transport | null {
  if (!process.env.LOGGLY_TOKEN || !process.env.LOGGLY_SUBDOMAIN) return null;

  return new LogglyTransport({
    token: process.env.LOGGLY_TOKEN,
    subdomain: process.env.LOGGLY_SUBDOMAIN,
    tags: ['learning-assistant', process.env.NODE_ENV || 'unknown'],
    level: 'info',
    json: true
  });
}

/**
 * Create Elasticsearch transport
 */
function createElasticsearchTransport(): winston.transport | null {
  if (!process.env.ELASTICSEARCH_URL) return null;

  return new ElasticsearchTransport({
    level: 'info',
    clientOpts: {
      node: process.env.ELASTICSEARCH_URL,
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || '',
        password: process.env.ELASTICSEARCH_PASSWORD || ''
      },
      ssl: {
        rejectUnauthorized: process.env.ELASTICSEARCH_SSL_VERIFY !== 'false'
      }
    },
    index: process.env.ELASTICSEARCH_INDEX || 'learning-assistant-logs',
    indexTemplate: {
      name: 'learning-assistant-logs-template',
      pattern: 'learning-assistant-logs-*',
      settings: {
        number_of_shards: 1,
        number_of_replicas: process.env.NODE_ENV === 'production' ? 1 : 0
      },
      mappings: {
        properties: {
          timestamp: { type: 'date' },
          level: { type: 'keyword' },
          message: { type: 'text' },
          service: { type: 'keyword' },
          environment: { type: 'keyword' },
          correlationId: { type: 'keyword' },
          userId: { type: 'keyword' },
          category: { type: 'keyword' },
          ip: { type: 'ip' },
          duration: { type: 'long' },
          statusCode: { type: 'integer' }
        }
      }
    }
  });
}

/**
 * Create Papertrail transport
 */
function createPapertrailTransport(): winston.transport | null {
  if (!process.env.PAPERTRAIL_HOST || !process.env.PAPERTRAIL_PORT) return null;

  return new PapertrailTransport({
    host: process.env.PAPERTRAIL_HOST,
    port: parseInt(process.env.PAPERTRAIL_PORT),
    hostname: process.env.PAPERTRAIL_HOSTNAME || 'learning-assistant',
    level: 'info',
    logFormat: function(level: string, message: string, meta: any) {
      return `[${level.toUpperCase()}] ${message} ${JSON.stringify(meta)}`;
    }
  });
}

/**
 * Create Syslog transport
 */
function createSyslogTransport(): winston.transport | null {
  if (!process.env.SYSLOG_HOST) return null;

  return new WinstonSyslog.Syslog({
    host: process.env.SYSLOG_HOST,
    port: parseInt(process.env.SYSLOG_PORT || '514'),
    protocol: process.env.SYSLOG_PROTOCOL || 'udp4',
    facility: process.env.SYSLOG_FACILITY || 'local0',
    level: 'info',
    app_name: 'learning-assistant',
    eol: '\n'
  });
}

/**
 * Custom HTTP transport for webhooks and custom endpoints
 */
class HttpTransport extends winston.Transport {
  private endpoint: string;
  private headers: Record<string, string>;
  private batchSize: number;
  private batchTimeout: number;
  private batch: any[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(options: {
    endpoint: string;
    headers?: Record<string, string>;
    batchSize?: number;
    batchTimeout?: number;
    level?: string;
  }) {
    super(options);
    this.endpoint = options.endpoint;
    this.headers = options.headers || {};
    this.batchSize = options.batchSize || 100;
    this.batchTimeout = options.batchTimeout || 5000;
  }

  log(info: any, callback: () => void) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    this.batch.push(info);

    if (this.batch.length >= this.batchSize) {
      this.flushBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.batchTimeout);
    }

    callback();
  }

  private async flushBatch() {
    if (this.batch.length === 0) return;

    const logsToSend = [...this.batch];
    this.batch = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers
        },
        body: JSON.stringify({
          logs: logsToSend,
          service: 'learning-assistant',
          timestamp: new Date().toISOString()
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.emit('error', error);
      // Re-add failed logs to batch for retry (but limit retries)
      if (logsToSend.length < 1000) { // Prevent infinite growth
        this.batch.unshift(...logsToSend);
      }
    }
  }

  close() {
    this.flushBatch();
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}

/**
 * Create DataDog transport
 */
function createDataDogTransport(): winston.transport | null {
  if (!process.env.DATADOG_API_KEY) return null;

  return new HttpTransport({
    endpoint: `https://http-intake.logs.datadoghq.com/v1/input/${process.env.DATADOG_API_KEY}`,
    headers: {
      'DD-API-KEY': process.env.DATADOG_API_KEY,
      'DD-APPLICATION-KEY': process.env.DATADOG_APP_KEY || '',
      'Content-Type': 'application/json'
    },
    batchSize: 100,
    batchTimeout: 5000,
    level: 'info'
  });
}

/**
 * Create Splunk transport
 */
function createSplunkTransport(): winston.transport | null {
  if (!process.env.SPLUNK_TOKEN || !process.env.SPLUNK_URL) return null;

  return new HttpTransport({
    endpoint: `${process.env.SPLUNK_URL}/services/collector`,
    headers: {
      'Authorization': `Splunk ${process.env.SPLUNK_TOKEN}`,
      'Content-Type': 'application/json'
    },
    batchSize: 50,
    batchTimeout: 10000,
    level: 'info'
  });
}

/**
 * Create New Relic transport
 */
function createNewRelicTransport(): winston.transport | null {
  if (!process.env.NEW_RELIC_LICENSE_KEY) return null;

  return new HttpTransport({
    endpoint: 'https://log-api.newrelic.com/log/v1',
    headers: {
      'Api-Key': process.env.NEW_RELIC_LICENSE_KEY,
      'Content-Type': 'application/json'
    },
    batchSize: 50,
    batchTimeout: 10000,
    level: 'info'
  });
}

/**
 * Create custom webhook transport
 */
function createWebhookTransport(): winston.transport | null {
  if (!process.env.LOG_WEBHOOK_URL) return null;

  return new HttpTransport({
    endpoint: process.env.LOG_WEBHOOK_URL,
    headers: {
      'Authorization': `Bearer ${process.env.LOG_WEBHOOK_TOKEN || ''}`,
      'Content-Type': 'application/json'
    },
    batchSize: 25,
    batchTimeout: 15000,
    level: 'warn'
  });
}

/**
 * Create all production transports
 */
export function createProductionTransports(): winston.transport[] {
  const transports: winston.transport[] = [];

  // Add file transports
  transports.push(...createFileTransports());

  // Add cloud/service transports
  const cloudTransports = [
    createLogzioTransport(),
    createLogglyTransport(),
    createElasticsearchTransport(),
    createPapertrailTransport(),
    createSyslogTransport(),
    createDataDogTransport(),
    createSplunkTransport(),
    createNewRelicTransport(),
    createWebhookTransport()
  ].filter(Boolean) as winston.transport[];

  transports.push(...cloudTransports);

  return transports;
}

/**
 * Health check for production transports
 */
export async function checkTransportHealth(): Promise<Record<string, boolean>> {
  const health: Record<string, boolean> = {};

  // Check external services
  const serviceChecks = [
    { name: 'logzio', url: 'https://listener.logz.io', enabled: !!process.env.LOGZIO_TOKEN },
    { name: 'elasticsearch', url: process.env.ELASTICSEARCH_URL, enabled: !!process.env.ELASTICSEARCH_URL },
    { name: 'datadog', url: 'https://api.datadoghq.com/api/v1/validate', enabled: !!process.env.DATADOG_API_KEY },
    { name: 'splunk', url: process.env.SPLUNK_URL, enabled: !!process.env.SPLUNK_URL },
    { name: 'webhook', url: process.env.LOG_WEBHOOK_URL, enabled: !!process.env.LOG_WEBHOOK_URL }
  ];

  for (const service of serviceChecks) {
    if (!service.enabled || !service.url) {
      health[service.name] = false;
      continue;
    }

    try {
      const response = await fetch(service.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      health[service.name] = response.ok;
    } catch (error) {
      health[service.name] = false;
    }
  }

  return health;
}

// Export the main transport array
export const productionTransports = createProductionTransports();

// Export individual transport creators for custom configurations
export {
  createFileTransports,
  createLogzioTransport,
  createLogglyTransport,
  createElasticsearchTransport,
  createPapertrailTransport,
  createSyslogTransport,
  createDataDogTransport,
  createSplunkTransport,
  createNewRelicTransport,
  createWebhookTransport,
  HttpTransport
};