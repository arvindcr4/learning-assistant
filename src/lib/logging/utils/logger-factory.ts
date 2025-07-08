/**
 * Logger Factory and Registry
 * 
 * Provides utilities for creating and managing logger instances:
 * - Logger factory with context
 * - Logger registry for centralized management
 * - Named loggers with inheritance
 * - Configuration management
 * - Lifecycle management
 */

import { EnhancedLogger, createLogger } from '../core/logger';
import { LogContext, LoggerConfig } from '../types';
import { correlationManager } from '../../correlation';

// Logger registry entry
interface LoggerRegistryEntry {
  logger: EnhancedLogger;
  config: Partial<LoggerConfig>;
  context: LogContext;
  created: Date;
  lastUsed: Date;
}

/**
 * Logger Factory Class
 */
export class LoggerFactory {
  private static instance: LoggerFactory;
  private registry: Map<string, LoggerRegistryEntry> = new Map();
  private defaultConfig: Partial<LoggerConfig> = {};
  private defaultContext: LogContext = {};

  private constructor() {}

  static getInstance(): LoggerFactory {
    if (!LoggerFactory.instance) {
      LoggerFactory.instance = new LoggerFactory();
    }
    return LoggerFactory.instance;
  }

  /**
   * Set default configuration for all new loggers
   */
  setDefaultConfig(config: Partial<LoggerConfig>): void {
    this.defaultConfig = { ...config };
  }

  /**
   * Set default context for all new loggers
   */
  setDefaultContext(context: LogContext): void {
    this.defaultContext = { ...context };
  }

  /**
   * Create a logger with optional name and configuration
   */
  createLogger(
    name?: string,
    config?: Partial<LoggerConfig>,
    context?: LogContext
  ): EnhancedLogger {
    const loggerName = name || `logger-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if logger already exists
    if (this.registry.has(loggerName)) {
      const entry = this.registry.get(loggerName)!;
      entry.lastUsed = new Date();
      return entry.logger;
    }

    // Merge configurations
    const finalConfig = {
      ...this.defaultConfig,
      ...config
    };

    // Merge contexts
    const finalContext = {
      ...this.defaultContext,
      ...context,
      component: name || context?.component || 'unknown',
      correlationId: context?.correlationId || correlationManager.getCurrentCorrelationId()
    };

    // Create the logger
    const logger = createLogger(finalConfig);

    // Create contextual wrapper
    const contextualLogger = this.createContextualWrapper(logger, finalContext);

    // Register the logger
    this.registry.set(loggerName, {
      logger: contextualLogger,
      config: finalConfig,
      context: finalContext,
      created: new Date(),
      lastUsed: new Date()
    });

    return contextualLogger;
  }

  /**
   * Get existing logger by name
   */
  getLogger(name: string): EnhancedLogger | null {
    const entry = this.registry.get(name);
    if (entry) {
      entry.lastUsed = new Date();
      return entry.logger;
    }
    return null;
  }

  /**
   * Create or get logger by name
   */
  getOrCreateLogger(
    name: string,
    config?: Partial<LoggerConfig>,
    context?: LogContext
  ): EnhancedLogger {
    const existing = this.getLogger(name);
    if (existing) {
      return existing;
    }
    return this.createLogger(name, config, context);
  }

  /**
   * Create contextual wrapper for logger
   */
  private createContextualWrapper(
    logger: EnhancedLogger,
    baseContext: LogContext
  ): EnhancedLogger {
    // Create a proxy that adds context to all log calls
    return new Proxy(logger, {
      get(target, prop) {
        if (typeof prop === 'string' && ['error', 'warn', 'info', 'debug', 'http', 'verbose', 'log'].includes(prop)) {
          return function(this: any, message: string, context?: LogContext) {
            const mergedContext = {
              ...baseContext,
              ...context,
              timestamp: new Date().toISOString()
            };
            return (target as any)[prop].call(this, message, mergedContext);
          };
        }
        return target[prop as keyof EnhancedLogger];
      }
    });
  }

  /**
   * Create module logger with standard naming
   */
  createModuleLogger(
    moduleName: string,
    subModule?: string,
    config?: Partial<LoggerConfig>
  ): EnhancedLogger {
    const name = subModule ? `${moduleName}.${subModule}` : moduleName;
    const context: LogContext = {
      module: moduleName,
      subModule,
      component: name
    };

    return this.createLogger(name, config, context);
  }

  /**
   * Create request logger with request context
   */
  createRequestLogger(
    requestId: string,
    method?: string,
    url?: string,
    userId?: string
  ): EnhancedLogger {
    const context: LogContext = {
      requestId,
      method,
      url,
      userId,
      correlationId: correlationManager.getCurrentCorrelationId(),
      category: 'request'
    };

    return this.createLogger(`request-${requestId}`, undefined, context);
  }

  /**
   * Create user logger with user context
   */
  createUserLogger(
    userId: string,
    sessionId?: string,
    additionalContext?: LogContext
  ): EnhancedLogger {
    const context: LogContext = {
      userId,
      sessionId,
      category: 'user',
      ...additionalContext
    };

    return this.createLogger(`user-${userId}`, undefined, context);
  }

  /**
   * Create business logger for business events
   */
  createBusinessLogger(
    businessUnit: string,
    process?: string,
    additionalContext?: LogContext
  ): EnhancedLogger {
    const context: LogContext = {
      businessUnit,
      businessProcess: process,
      category: 'business',
      ...additionalContext
    };

    const name = process ? `business.${businessUnit}.${process}` : `business.${businessUnit}`;
    return this.createLogger(name, undefined, context);
  }

  /**
   * Create performance logger for specific operations
   */
  createPerformanceLogger(
    operation: string,
    additionalContext?: LogContext
  ): EnhancedLogger {
    const context: LogContext = {
      operation,
      category: 'performance',
      ...additionalContext
    };

    return this.createLogger(`performance.${operation}`, undefined, context);
  }

  /**
   * Create security logger for security events
   */
  createSecurityLogger(
    securityDomain: string,
    additionalContext?: LogContext
  ): EnhancedLogger {
    const context: LogContext = {
      securityDomain,
      category: 'security',
      ...additionalContext
    };

    return this.createLogger(`security.${securityDomain}`, undefined, context);
  }

  /**
   * List all registered loggers
   */
  listLoggers(): Array<{
    name: string;
    config: Partial<LoggerConfig>;
    context: LogContext;
    created: Date;
    lastUsed: Date;
  }> {
    const loggers: Array<any> = [];
    
    for (const [name, entry] of this.registry) {
      loggers.push({
        name,
        config: entry.config,
        context: entry.context,
        created: entry.created,
        lastUsed: entry.lastUsed
      });
    }

    return loggers;
  }

  /**
   * Remove logger from registry
   */
  removeLogger(name: string): boolean {
    return this.registry.delete(name);
  }

  /**
   * Clear all loggers from registry
   */
  clearRegistry(): void {
    this.registry.clear();
  }

  /**
   * Clean up unused loggers (older than specified time)
   */
  cleanupUnusedLoggers(maxAgeMs: number = 3600000): number { // 1 hour default
    const cutoff = new Date(Date.now() - maxAgeMs);
    let cleaned = 0;

    for (const [name, entry] of this.registry) {
      if (entry.lastUsed < cutoff) {
        this.registry.delete(name);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get registry statistics
   */
  getStatistics(): {
    totalLoggers: number;
    oldestLogger: Date | null;
    newestLogger: Date | null;
    mostRecentlyUsed: Date | null;
    categories: Record<string, number>;
  } {
    const stats = {
      totalLoggers: this.registry.size,
      oldestLogger: null as Date | null,
      newestLogger: null as Date | null,
      mostRecentlyUsed: null as Date | null,
      categories: {} as Record<string, number>
    };

    for (const entry of this.registry.values()) {
      // Track creation dates
      if (!stats.oldestLogger || entry.created < stats.oldestLogger) {
        stats.oldestLogger = entry.created;
      }
      if (!stats.newestLogger || entry.created > stats.newestLogger) {
        stats.newestLogger = entry.created;
      }

      // Track usage dates
      if (!stats.mostRecentlyUsed || entry.lastUsed > stats.mostRecentlyUsed) {
        stats.mostRecentlyUsed = entry.lastUsed;
      }

      // Count categories
      const category = entry.context.category || 'uncategorized';
      stats.categories[category] = (stats.categories[category] || 0) + 1;
    }

    return stats;
  }

  /**
   * Export logger configurations (for backup/restore)
   */
  exportConfigurations(): Record<string, {
    config: Partial<LoggerConfig>;
    context: LogContext;
  }> {
    const configs: Record<string, any> = {};
    
    for (const [name, entry] of this.registry) {
      configs[name] = {
        config: entry.config,
        context: entry.context
      };
    }

    return configs;
  }

  /**
   * Import logger configurations
   */
  importConfigurations(configs: Record<string, {
    config: Partial<LoggerConfig>;
    context: LogContext;
  }>): void {
    for (const [name, { config, context }] of Object.entries(configs)) {
      this.createLogger(name, config, context);
    }
  }
}

/**
 * Logger Registry for managing named loggers
 */
export class LoggerRegistry {
  private static instance: LoggerRegistry;
  private factory: LoggerFactory;
  private namedLoggers: Map<string, EnhancedLogger> = new Map();

  private constructor() {
    this.factory = LoggerFactory.getInstance();
  }

  static getInstance(): LoggerRegistry {
    if (!LoggerRegistry.instance) {
      LoggerRegistry.instance = new LoggerRegistry();
    }
    return LoggerRegistry.instance;
  }

  /**
   * Register a named logger
   */
  register(name: string, logger: EnhancedLogger): void {
    this.namedLoggers.set(name, logger);
  }

  /**
   * Get a named logger
   */
  get(name: string): EnhancedLogger | null {
    return this.namedLoggers.get(name) || null;
  }

  /**
   * Get or create a named logger
   */
  getOrCreate(
    name: string,
    config?: Partial<LoggerConfig>,
    context?: LogContext
  ): EnhancedLogger {
    const existing = this.get(name);
    if (existing) {
      return existing;
    }

    const logger = this.factory.createLogger(name, config, context);
    this.register(name, logger);
    return logger;
  }

  /**
   * Remove a named logger
   */
  remove(name: string): boolean {
    return this.namedLoggers.delete(name);
  }

  /**
   * List all named loggers
   */
  list(): string[] {
    return Array.from(this.namedLoggers.keys());
  }

  /**
   * Clear all named loggers
   */
  clear(): void {
    this.namedLoggers.clear();
  }
}

// Create singleton instances
export const loggerFactory = LoggerFactory.getInstance();
export const loggerRegistry = LoggerRegistry.getInstance();

// Convenience functions
export function createContextualLogger(context: LogContext): EnhancedLogger {
  return loggerFactory.createLogger(undefined, undefined, context);
}

export function createModuleLogger(
  moduleName: string,
  subModule?: string
): EnhancedLogger {
  return loggerFactory.createModuleLogger(moduleName, subModule);
}

export function createRequestLogger(
  requestId: string,
  method?: string,
  url?: string,
  userId?: string
): EnhancedLogger {
  return loggerFactory.createRequestLogger(requestId, method, url, userId);
}

export function createUserLogger(
  userId: string,
  sessionId?: string,
  additionalContext?: LogContext
): EnhancedLogger {
  return loggerFactory.createUserLogger(userId, sessionId, additionalContext);
}

export function getOrCreateLogger(
  name: string,
  config?: Partial<LoggerConfig>,
  context?: LogContext
): EnhancedLogger {
  return loggerRegistry.getOrCreate(name, config, context);
}

export default loggerFactory;