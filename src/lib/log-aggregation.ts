import winston from 'winston';
import Transport from 'winston-transport';
import { correlationManager } from './correlation';

// Log aggregation service types
export enum LogAggregationProvider {
  DATADOG = 'datadog',
  SPLUNK = 'splunk',
  ELASTICSEARCH = 'elasticsearch',
  LOGZIO = 'logzio',
  PAPERTRAIL = 'papertrail',
  LOGDNA = 'logdna',
  SYSLOG = 'syslog',
  CUSTOM = 'custom',
}

// Log aggregation configuration
export interface LogAggregationConfig {
  provider: LogAggregationProvider;
  enabled: boolean;
  apiKey?: string;
  endpoint?: string;
  index?: string;
  source?: string;
  tags?: Record<string, string>;
  batchSize?: number;
  flushInterval?: number;
  retryAttempts?: number;
  retryDelay?: number;
  compression?: boolean;
  ssl?: boolean;
  timeout?: number;
  metadata?: Record<string, any>;
}

// Log shipping interface
export interface LogShipper {
  ship(logs: any[]): Promise<void>;
  flush(): Promise<void>;
  configure(config: LogAggregationConfig): void;
}

// DataDog log shipper
class DataDogShipper implements LogShipper {
  private config: LogAggregationConfig;
  private buffer: any[] = [];
  private flushTimer?: NodeJS.Timeout;
  
  constructor(config: LogAggregationConfig) {
    this.config = config;
    this.setupFlushTimer();
  }
  
  configure(config: LogAggregationConfig): void {
    this.config = config;
    this.setupFlushTimer();
  }
  
  async ship(logs: any[]): Promise<void> {
    if (!this.config.enabled) return;
    
    this.buffer.push(...logs);
    
    if (this.buffer.length >= (this.config.batchSize || 100)) {
      await this.flush();
    }
  }
  
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const batch = this.buffer.splice(0);
    
    try {
      const response = await fetch(`${this.config.endpoint || 'https://http-intake.logs.datadoghq.com'}/v1/input/${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.config.apiKey || '',
        },
        body: JSON.stringify(batch.map(log => ({
          ...log,
          ddtags: Object.entries(this.config.tags || {}).map(([k, v]) => `${k}:${v}`).join(','),
          service: 'learning-assistant',
          source: this.config.source || 'nodejs',
        }))),
      });
      
      if (!response.ok) {
        throw new Error(`DataDog API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to ship logs to DataDog:', error);
      // In production, you might want to retry or store failed logs
    }
  }
  
  private setupFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushInterval || 5000);
  }
}

// Splunk log shipper
class SplunkShipper implements LogShipper {
  private config: LogAggregationConfig;
  private buffer: any[] = [];
  private flushTimer?: NodeJS.Timeout;
  
  constructor(config: LogAggregationConfig) {
    this.config = config;
    this.setupFlushTimer();
  }
  
  configure(config: LogAggregationConfig): void {
    this.config = config;
    this.setupFlushTimer();
  }
  
  async ship(logs: any[]): Promise<void> {
    if (!this.config.enabled) return;
    
    this.buffer.push(...logs);
    
    if (this.buffer.length >= (this.config.batchSize || 100)) {
      await this.flush();
    }
  }
  
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const batch = this.buffer.splice(0);
    
    try {
      const events = batch.map(log => ({
        event: log,
        source: this.config.source || 'nodejs',
        sourcetype: 'json',
        index: this.config.index || 'main',
        host: process.env.HOSTNAME || 'unknown',
      }));
      
      const response = await fetch(`${this.config.endpoint}/services/collector/event`, {
        method: 'POST',
        headers: {
          'Authorization': `Splunk ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });
      
      if (!response.ok) {
        throw new Error(`Splunk API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to ship logs to Splunk:', error);
    }
  }
  
  private setupFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushInterval || 5000);
  }
}

// Elasticsearch log shipper
class ElasticsearchShipper implements LogShipper {
  private config: LogAggregationConfig;
  private buffer: any[] = [];
  private flushTimer?: NodeJS.Timeout;
  
  constructor(config: LogAggregationConfig) {
    this.config = config;
    this.setupFlushTimer();
  }
  
  configure(config: LogAggregationConfig): void {
    this.config = config;
    this.setupFlushTimer();
  }
  
  async ship(logs: any[]): Promise<void> {
    if (!this.config.enabled) return;
    
    this.buffer.push(...logs);
    
    if (this.buffer.length >= (this.config.batchSize || 100)) {
      await this.flush();
    }
  }
  
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const batch = this.buffer.splice(0);
    
    try {
      const bulkBody = [];
      
      for (const log of batch) {
        bulkBody.push({
          index: {
            _index: this.config.index || 'logs',
            _type: '_doc',
          }
        });
        bulkBody.push(log);
      }
      
      const response = await fetch(`${this.config.endpoint}/_bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: bulkBody.map(item => JSON.stringify(item)).join('\n') + '\n',
      });
      
      if (!response.ok) {
        throw new Error(`Elasticsearch API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to ship logs to Elasticsearch:', error);
    }
  }
  
  private setupFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushInterval || 5000);
  }
}

// Custom Winston transport for log aggregation
class LogAggregationTransport extends Transport {
  private shippers: LogShipper[] = [];
  private config: LogAggregationConfig;
  
  constructor(config: LogAggregationConfig) {
    super();
    this.config = config;
    this.setupShippers();
  }
  
  private setupShippers(): void {
    switch (this.config.provider) {
      case LogAggregationProvider.DATADOG:
        this.shippers.push(new DataDogShipper(this.config));
        break;
      case LogAggregationProvider.SPLUNK:
        this.shippers.push(new SplunkShipper(this.config));
        break;
      case LogAggregationProvider.ELASTICSEARCH:
        this.shippers.push(new ElasticsearchShipper(this.config));
        break;
      default:
        console.warn(`Log aggregation provider ${this.config.provider} not implemented`);
    }
  }
  
  log(info: any, callback: () => void): void {
    if (!this.config.enabled) {
      callback();
      return;
    }
    
    // Enrich log with correlation context
    const correlationContext = correlationManager.getLoggingContext();
    const enrichedLog = {
      ...info,
      ...correlationContext,
      timestamp: new Date().toISOString(),
      service: 'learning-assistant',
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      hostname: process.env.HOSTNAME || 'unknown',
      pid: process.pid,
      ...this.config.metadata,
    };
    
    // Ship to all configured aggregation services
    Promise.all(
      this.shippers.map(shipper => shipper.ship([enrichedLog]))
    ).catch(error => {
      console.error('Failed to ship logs:', error);
    });
    
    callback();
  }
  
  async close(): Promise<void> {
    // Flush all shippers before closing
    await Promise.all(
      this.shippers.map(shipper => shipper.flush())
    );
  }
}

// Log aggregation manager
export class LogAggregationManager {
  private static instance: LogAggregationManager;
  private configs: Map<string, LogAggregationConfig> = new Map();
  private transports: Map<string, LogAggregationTransport> = new Map();
  
  private constructor() {}
  
  static getInstance(): LogAggregationManager {
    if (!LogAggregationManager.instance) {
      LogAggregationManager.instance = new LogAggregationManager();
    }
    return LogAggregationManager.instance;
  }
  
  // Configure log aggregation
  configure(name: string, config: LogAggregationConfig): void {
    this.configs.set(name, config);
    
    if (config.enabled) {
      const transport = new LogAggregationTransport(config);
      this.transports.set(name, transport);
    }
  }
  
  // Get configured transports for Winston
  getTransports(): winston.transport[] {
    return Array.from(this.transports.values());
  }
  
  // Get specific transport
  getTransport(name: string): LogAggregationTransport | undefined {
    return this.transports.get(name);
  }
  
  // Close all transports
  async close(): Promise<void> {
    await Promise.all(
      Array.from(this.transports.values()).map(transport => transport.close())
    );
  }
  
  // Health check for log aggregation services
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [name, config] of this.configs) {
      if (!config.enabled) {
        results[name] = false;
        continue;
      }
      
      try {
        // Simple health check by trying to ship a test log
        const transport = this.transports.get(name);
        if (transport) {
          await new Promise<void>((resolve, reject) => {
            transport.log({
              level: 'info',
              message: 'Health check',
              timestamp: new Date().toISOString(),
              healthCheck: true,
            }, () => resolve());
          });
          results[name] = true;
        } else {
          results[name] = false;
        }
      } catch (error) {
        results[name] = false;
      }
    }
    
    return results;
  }
}

// Singleton instance
export const logAggregationManager = LogAggregationManager.getInstance();

// Default configurations for common providers
export const defaultConfigs: Record<LogAggregationProvider, Partial<LogAggregationConfig>> = {
  [LogAggregationProvider.DATADOG]: {
    endpoint: 'https://http-intake.logs.datadoghq.com',
    batchSize: 100,
    flushInterval: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
    compression: true,
    ssl: true,
    timeout: 30000,
  },
  [LogAggregationProvider.SPLUNK]: {
    batchSize: 100,
    flushInterval: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
    compression: true,
    ssl: true,
    timeout: 30000,
  },
  [LogAggregationProvider.ELASTICSEARCH]: {
    batchSize: 100,
    flushInterval: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
    compression: true,
    ssl: true,
    timeout: 30000,
  },
  [LogAggregationProvider.LOGZIO]: {
    endpoint: 'https://listener.logz.io',
    batchSize: 100,
    flushInterval: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
    compression: true,
    ssl: true,
    timeout: 30000,
  },
  [LogAggregationProvider.PAPERTRAIL]: {
    batchSize: 100,
    flushInterval: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
    ssl: true,
    timeout: 30000,
  },
  [LogAggregationProvider.LOGDNA]: {
    endpoint: 'https://logs.logdna.com',
    batchSize: 100,
    flushInterval: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
    compression: true,
    ssl: true,
    timeout: 30000,
  },
  [LogAggregationProvider.SYSLOG]: {
    batchSize: 100,
    flushInterval: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
    ssl: false,
    timeout: 30000,
  },
  [LogAggregationProvider.CUSTOM]: {
    batchSize: 100,
    flushInterval: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
    ssl: true,
    timeout: 30000,
  },
};

// Configuration helper
export function createLogAggregationConfig(
  provider: LogAggregationProvider,
  overrides: Partial<LogAggregationConfig> = {}
): LogAggregationConfig {
  const defaults = defaultConfigs[provider];
  
  return {
    provider,
    enabled: false,
    ...defaults,
    ...overrides,
  };
}

// Environment-based configuration
export function configureFromEnvironment(): void {
  // DataDog configuration
  if (process.env.DATADOG_API_KEY) {
    logAggregationManager.configure('datadog', {
      provider: LogAggregationProvider.DATADOG,
      enabled: true,
      apiKey: process.env.DATADOG_API_KEY,
      endpoint: process.env.DATADOG_ENDPOINT,
      source: process.env.DATADOG_SOURCE || 'nodejs',
      tags: {
        service: 'learning-assistant',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
      },
      ...defaultConfigs[LogAggregationProvider.DATADOG],
    });
  }
  
  // Splunk configuration
  if (process.env.SPLUNK_TOKEN) {
    logAggregationManager.configure('splunk', {
      provider: LogAggregationProvider.SPLUNK,
      enabled: true,
      apiKey: process.env.SPLUNK_TOKEN,
      endpoint: process.env.SPLUNK_ENDPOINT,
      index: process.env.SPLUNK_INDEX || 'main',
      source: process.env.SPLUNK_SOURCE || 'nodejs',
      ...defaultConfigs[LogAggregationProvider.SPLUNK],
    });
  }
  
  // Elasticsearch configuration
  if (process.env.ELASTICSEARCH_ENDPOINT) {
    logAggregationManager.configure('elasticsearch', {
      provider: LogAggregationProvider.ELASTICSEARCH,
      enabled: true,
      endpoint: process.env.ELASTICSEARCH_ENDPOINT,
      apiKey: process.env.ELASTICSEARCH_API_KEY,
      index: process.env.ELASTICSEARCH_INDEX || 'logs',
      ...defaultConfigs[LogAggregationProvider.ELASTICSEARCH],
    });
  }
  
  // LogzIO configuration
  if (process.env.LOGZIO_TOKEN) {
    logAggregationManager.configure('logzio', {
      provider: LogAggregationProvider.LOGZIO,
      enabled: true,
      apiKey: process.env.LOGZIO_TOKEN,
      endpoint: process.env.LOGZIO_ENDPOINT,
      ...defaultConfigs[LogAggregationProvider.LOGZIO],
    });
  }
}

// Initialize log aggregation from environment
export function initializeLogAggregation(): void {
  configureFromEnvironment();
}

// Export types and utilities
export {
  LogAggregationTransport,
  DataDogShipper,
  SplunkShipper,
  ElasticsearchShipper,
};