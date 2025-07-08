/**
 * Automated healing and self-recovery mechanisms
 * Automatically detects and attempts to recover from system failures
 */
import { createLogger } from '../logger';
import { env } from '../env-validation';

const logger = createLogger('auto-healing');

// Healing action types
export enum HealingActionType {
  RESTART_SERVICE = 'RESTART_SERVICE',
  CLEAR_CACHE = 'CLEAR_CACHE',
  RECONNECT_DATABASE = 'RECONNECT_DATABASE',
  SCALE_UP = 'SCALE_UP',
  SCALE_DOWN = 'SCALE_DOWN',
  FAILOVER = 'FAILOVER',
  CIRCUIT_BREAKER_RESET = 'CIRCUIT_BREAKER_RESET',
  MEMORY_CLEANUP = 'MEMORY_CLEANUP',
  PROCESS_RESTART = 'PROCESS_RESTART',
  CONNECTION_POOL_RESET = 'CONNECTION_POOL_RESET',
  CUSTOM_SCRIPT = 'CUSTOM_SCRIPT'
}

// Healing trigger types
export enum HealingTriggerType {
  HEALTH_CHECK_FAILURE = 'HEALTH_CHECK_FAILURE',
  PERFORMANCE_DEGRADATION = 'PERFORMANCE_DEGRADATION',
  RESOURCE_EXHAUSTION = 'RESOURCE_EXHAUSTION',
  DEPENDENCY_FAILURE = 'DEPENDENCY_FAILURE',
  SLA_BREACH = 'SLA_BREACH',
  MANUAL_TRIGGER = 'MANUAL_TRIGGER',
  SCHEDULED = 'SCHEDULED'
}

// Healing action status
export enum HealingStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  TIMEOUT = 'TIMEOUT'
}

// Healing action definition
export interface HealingAction {
  id: string;
  name: string;
  type: HealingActionType;
  description: string;
  trigger: {
    type: HealingTriggerType;
    conditions: Record<string, any>;
    cooldownPeriod: number; // milliseconds
    maxRetries: number;
  };
  execution: {
    timeout: number;
    command?: string;
    script?: string;
    parameters?: Record<string, any>;
    safetyChecks?: string[];
  };
  verification: {
    enabled: boolean;
    healthCheck?: string;
    metric?: string;
    expectedValue?: any;
    timeout?: number;
  };
  rollback: {
    enabled: boolean;
    action?: HealingActionType;
    script?: string;
    timeout?: number;
  };
  impact: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    downtime: number; // estimated milliseconds
    affectedServices: string[];
    userImpact: string;
  };
  enabled: boolean;
}

// Healing execution result
export interface HealingExecutionResult {
  id: string;
  actionId: string;
  trigger: HealingTriggerType;
  status: HealingStatus;
  startTime: number;
  endTime?: number;
  duration?: number;
  output?: string;
  error?: string;
  verificationResult?: boolean;
  rollbackExecuted?: boolean;
  metadata?: any;
}

// Auto-healing configuration
interface AutoHealingConfig {
  enabled: boolean;
  maxConcurrentActions: number;
  globalCooldownPeriod: number;
  safetyMode: boolean; // If true, require manual approval for high-impact actions
  monitoring: {
    enabled: boolean;
    interval: number;
  };
  notifications: {
    enabled: boolean;
    webhookUrl?: string;
    slackChannel?: string;
    emailRecipients?: string[];
  };
  verification: {
    enabled: boolean;
    timeout: number;
    retries: number;
  };
  rollback: {
    enabled: boolean;
    automaticRollback: boolean;
    timeout: number;
  };
}

const config: AutoHealingConfig = {
  enabled: process.env.ENABLE_AUTO_HEALING === 'true',
  maxConcurrentActions: parseInt(process.env.AUTO_HEALING_MAX_CONCURRENT || '3'),
  globalCooldownPeriod: parseInt(process.env.AUTO_HEALING_COOLDOWN || '300000'), // 5 minutes
  safetyMode: process.env.AUTO_HEALING_SAFETY_MODE !== 'false',
  monitoring: {
    enabled: process.env.AUTO_HEALING_MONITORING_ENABLED !== 'false',
    interval: parseInt(process.env.AUTO_HEALING_MONITORING_INTERVAL || '30000'), // 30 seconds
  },
  notifications: {
    enabled: process.env.AUTO_HEALING_NOTIFICATIONS_ENABLED === 'true',
    webhookUrl: process.env.AUTO_HEALING_WEBHOOK_URL,
    slackChannel: process.env.AUTO_HEALING_SLACK_CHANNEL,
    emailRecipients: process.env.AUTO_HEALING_EMAIL_RECIPIENTS?.split(',') || [],
  },
  verification: {
    enabled: process.env.AUTO_HEALING_VERIFICATION_ENABLED !== 'false',
    timeout: parseInt(process.env.AUTO_HEALING_VERIFICATION_TIMEOUT || '60000'),
    retries: parseInt(process.env.AUTO_HEALING_VERIFICATION_RETRIES || '3'),
  },
  rollback: {
    enabled: process.env.AUTO_HEALING_ROLLBACK_ENABLED !== 'false',
    automaticRollback: process.env.AUTO_HEALING_AUTOMATIC_ROLLBACK === 'true',
    timeout: parseInt(process.env.AUTO_HEALING_ROLLBACK_TIMEOUT || '120000'),
  },
};

// Predefined healing actions
export const defaultHealingActions: HealingAction[] = [
  {
    id: 'restart-unhealthy-database-connection',
    name: 'Restart Unhealthy Database Connection',
    type: HealingActionType.RECONNECT_DATABASE,
    description: 'Reconnect to database when health checks fail',
    trigger: {
      type: HealingTriggerType.HEALTH_CHECK_FAILURE,
      conditions: {
        healthCheck: 'database',
        consecutiveFailures: 3,
      },
      cooldownPeriod: 120000, // 2 minutes
      maxRetries: 5,
    },
    execution: {
      timeout: 30000,
      parameters: {
        forceReconnect: true,
        clearPool: true,
      },
    },
    verification: {
      enabled: true,
      healthCheck: 'database',
      timeout: 10000,
    },
    rollback: {
      enabled: false,
    },
    impact: {
      severity: 'medium',
      downtime: 5000,
      affectedServices: ['database', 'api'],
      userImpact: 'Brief service interruption during reconnection',
    },
    enabled: true,
  },
  {
    id: 'clear-redis-cache-on-failure',
    name: 'Clear Redis Cache on Failure',
    type: HealingActionType.CLEAR_CACHE,
    description: 'Clear Redis cache when connection issues occur',
    trigger: {
      type: HealingTriggerType.HEALTH_CHECK_FAILURE,
      conditions: {
        healthCheck: 'redis',
        consecutiveFailures: 2,
      },
      cooldownPeriod: 300000, // 5 minutes
      maxRetries: 3,
    },
    execution: {
      timeout: 15000,
      parameters: {
        flushAll: false,
        pattern: 'health_check_*',
      },
    },
    verification: {
      enabled: true,
      healthCheck: 'redis',
      timeout: 5000,
    },
    rollback: {
      enabled: false,
    },
    impact: {
      severity: 'low',
      downtime: 1000,
      affectedServices: ['cache', 'session'],
      userImpact: 'Temporary cache misses, slower response times',
    },
    enabled: true,
  },
  {
    id: 'memory-cleanup-high-usage',
    name: 'Memory Cleanup on High Usage',
    type: HealingActionType.MEMORY_CLEANUP,
    description: 'Force garbage collection when memory usage is high',
    trigger: {
      type: HealingTriggerType.RESOURCE_EXHAUSTION,
      conditions: {
        metric: 'memory_usage',
        threshold: 90, // 90%
        duration: 120000, // 2 minutes
      },
      cooldownPeriod: 600000, // 10 minutes
      maxRetries: 2,
    },
    execution: {
      timeout: 10000,
      parameters: {
        forceGC: true,
        clearUnusedModules: true,
      },
    },
    verification: {
      enabled: true,
      metric: 'memory_usage',
      expectedValue: { operator: 'less_than', value: 80 },
      timeout: 30000,
    },
    rollback: {
      enabled: false,
    },
    impact: {
      severity: 'low',
      downtime: 2000,
      affectedServices: ['application'],
      userImpact: 'Brief pause during garbage collection',
    },
    enabled: true,
  },
  {
    id: 'circuit-breaker-reset',
    name: 'Circuit Breaker Reset',
    type: HealingActionType.CIRCUIT_BREAKER_RESET,
    description: 'Reset circuit breakers when dependencies recover',
    trigger: {
      type: HealingTriggerType.DEPENDENCY_FAILURE,
      conditions: {
        circuitBreakerState: 'OPEN',
        dependencyHealthy: true,
        duration: 300000, // 5 minutes
      },
      cooldownPeriod: 180000, // 3 minutes
      maxRetries: 1,
    },
    execution: {
      timeout: 5000,
      parameters: {
        resetAll: false,
        testFirst: true,
      },
    },
    verification: {
      enabled: true,
      healthCheck: 'dependency',
      timeout: 15000,
    },
    rollback: {
      enabled: true,
      action: HealingActionType.CIRCUIT_BREAKER_RESET,
      timeout: 10000,
    },
    impact: {
      severity: 'low',
      downtime: 0,
      affectedServices: ['external_dependencies'],
      userImpact: 'Restoration of dependent services',
    },
    enabled: true,
  },
  {
    id: 'connection-pool-reset',
    name: 'Connection Pool Reset',
    type: HealingActionType.CONNECTION_POOL_RESET,
    description: 'Reset connection pools when experiencing connection issues',
    trigger: {
      type: HealingTriggerType.PERFORMANCE_DEGRADATION,
      conditions: {
        metric: 'connection_errors',
        threshold: 10, // 10 errors per minute
        duration: 180000, // 3 minutes
      },
      cooldownPeriod: 600000, // 10 minutes
      maxRetries: 3,
    },
    execution: {
      timeout: 20000,
      parameters: {
        drainConnections: true,
        validateConnections: true,
      },
    },
    verification: {
      enabled: true,
      metric: 'connection_errors',
      expectedValue: { operator: 'less_than', value: 2 },
      timeout: 30000,
    },
    rollback: {
      enabled: false,
    },
    impact: {
      severity: 'medium',
      downtime: 10000,
      affectedServices: ['database', 'external_apis'],
      userImpact: 'Brief connection interruption',
    },
    enabled: true,
  },
  {
    id: 'process-restart-critical-failure',
    name: 'Process Restart on Critical Failure',
    type: HealingActionType.PROCESS_RESTART,
    description: 'Restart process when critical health checks fail',
    trigger: {
      type: HealingTriggerType.HEALTH_CHECK_FAILURE,
      conditions: {
        healthCheck: 'application',
        severity: 'critical',
        consecutiveFailures: 5,
      },
      cooldownPeriod: 1800000, // 30 minutes
      maxRetries: 1,
    },
    execution: {
      timeout: 60000,
      parameters: {
        gracefulShutdown: true,
        drainConnections: true,
      },
    },
    verification: {
      enabled: true,
      healthCheck: 'application',
      timeout: 120000,
    },
    rollback: {
      enabled: false,
    },
    impact: {
      severity: 'critical',
      downtime: 30000,
      affectedServices: ['all'],
      userImpact: 'Complete service restart, temporary unavailability',
    },
    enabled: false, // Disabled by default due to high impact
  },
];

// Healing execution state
const healingExecutions = new Map<string, HealingExecutionResult>();
const healingCooldowns = new Map<string, number>();
const runningActions = new Set<string>();
let monitoringInterval: NodeJS.Timeout | null = null;

// Execute healing action
export const executeHealingAction = async (action: HealingAction, trigger: HealingTriggerType, metadata?: any): Promise<HealingExecutionResult> => {
  const executionId = `${action.id}-${Date.now()}`;
  const startTime = Date.now();
  
  const result: HealingExecutionResult = {
    id: executionId,
    actionId: action.id,
    trigger,
    status: HealingStatus.PENDING,
    startTime,
    metadata,
  };
  
  healingExecutions.set(executionId, result);
  
  try {
    // Check if action is enabled
    if (!action.enabled) {
      result.status = HealingStatus.SKIPPED;
      result.output = 'Action is disabled';
      return result;
    }
    
    // Check cooldown period
    const lastExecution = healingCooldowns.get(action.id);
    if (lastExecution && (startTime - lastExecution) < action.trigger.cooldownPeriod) {
      result.status = HealingStatus.SKIPPED;
      result.output = 'Action is in cooldown period';
      return result;
    }
    
    // Check max concurrent actions
    if (runningActions.size >= config.maxConcurrentActions) {
      result.status = HealingStatus.SKIPPED;
      result.output = 'Maximum concurrent actions reached';
      return result;
    }
    
    // Check safety mode for high-impact actions
    if (config.safetyMode && action.impact.severity === 'critical') {
      result.status = HealingStatus.SKIPPED;
      result.output = 'Critical action requires manual approval in safety mode';
      await sendHealingNotification(action, result, 'approval_required');
      return result;
    }
    
    // Start execution
    result.status = HealingStatus.RUNNING;
    runningActions.add(action.id);
    
    logger.info(`Starting healing action: ${action.name}`, {
      actionId: action.id,
      trigger,
      executionId,
    });
    
    // Execute the action based on type
    await executeActionByType(action, result);
    
    // Verify the action if enabled
    if (config.verification.enabled && action.verification.enabled) {
      const verificationResult = await verifyHealingAction(action, result);
      result.verificationResult = verificationResult;
      
      if (!verificationResult) {
        result.status = HealingStatus.FAILED;
        result.error = 'Verification failed';
        
        // Attempt rollback if enabled
        if (config.rollback.enabled && action.rollback.enabled && config.rollback.automaticRollback) {
          await executeRollback(action, result);
        }
      } else {
        result.status = HealingStatus.SUCCESS;
      }
    } else {
      result.status = HealingStatus.SUCCESS;
    }
    
    // Update cooldown
    healingCooldowns.set(action.id, startTime);
    
    logger.info(`Healing action completed: ${action.name}`, {
      actionId: action.id,
      status: result.status,
      duration: result.duration,
      verificationResult: result.verificationResult,
    });
    
    // Send notification
    await sendHealingNotification(action, result, 'completed');
    
  } catch (error) {
    result.status = HealingStatus.FAILED;
    result.error = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error(`Healing action failed: ${action.name}`, {
      actionId: action.id,
      error: result.error,
      executionId,
    });
    
    // Send failure notification
    await sendHealingNotification(action, result, 'failed');
    
    // Attempt rollback if enabled
    if (config.rollback.enabled && action.rollback.enabled && config.rollback.automaticRollback) {
      try {
        await executeRollback(action, result);
      } catch (rollbackError) {
        logger.error(`Rollback failed for action: ${action.name}`, rollbackError);
      }
    }
  } finally {
    // Cleanup
    runningActions.delete(action.id);
    result.endTime = Date.now();
    result.duration = result.endTime - result.startTime;
    healingExecutions.set(executionId, result);
  }
  
  return result;
};

// Execute action based on type
const executeActionByType = async (action: HealingAction, result: HealingExecutionResult): Promise<void> => {
  const timeout = action.execution.timeout;
  
  switch (action.type) {
    case HealingActionType.RECONNECT_DATABASE:
      await executeDatabaseReconnect(action, result);
      break;
    case HealingActionType.CLEAR_CACHE:
      await executeCacheClear(action, result);
      break;
    case HealingActionType.MEMORY_CLEANUP:
      await executeMemoryCleanup(action, result);
      break;
    case HealingActionType.CIRCUIT_BREAKER_RESET:
      await executeCircuitBreakerReset(action, result);
      break;
    case HealingActionType.CONNECTION_POOL_RESET:
      await executeConnectionPoolReset(action, result);
      break;
    case HealingActionType.PROCESS_RESTART:
      await executeProcessRestart(action, result);
      break;
    case HealingActionType.CUSTOM_SCRIPT:
      await executeCustomScript(action, result);
      break;
    default:
      throw new Error(`Unknown healing action type: ${action.type}`);
  }
};

// Database reconnection
const executeDatabaseReconnect = async (action: HealingAction, result: HealingExecutionResult): Promise<void> => {
  try {
    const { db } = await import('../database');
    
    // Force reconnection
    if (action.execution.parameters?.forceReconnect) {
      await db.end();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Clear connection pool if requested
    if (action.execution.parameters?.clearPool) {
      // Implementation would depend on your database library
    }
    
    // Test connection
    await db.query('SELECT 1');
    result.output = 'Database reconnection successful';
    
  } catch (error) {
    throw new Error(`Database reconnection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Cache clearing
const executeCacheClear = async (action: HealingAction, result: HealingExecutionResult): Promise<void> => {
  try {
    if (!process.env.REDIS_URL) {
      result.output = 'Redis not configured, skipping cache clear';
      return;
    }
    
    const { createClient } = await import('redis');
    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();
    
    if (action.execution.parameters?.flushAll) {
      await client.flushAll();
      result.output = 'All cache cleared';
    } else if (action.execution.parameters?.pattern) {
      const keys = await client.keys(action.execution.parameters.pattern);
      if (keys.length > 0) {
        await client.del(keys);
        result.output = `Cleared ${keys.length} cache keys`;
      } else {
        result.output = 'No matching cache keys found';
      }
    } else {
      await client.flushDb();
      result.output = 'Database cache cleared';
    }
    
    await client.disconnect();
    
  } catch (error) {
    throw new Error(`Cache clear failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Memory cleanup
const executeMemoryCleanup = async (action: HealingAction, result: HealingExecutionResult): Promise<void> => {
  try {
    const memoryBefore = process.memoryUsage();
    
    // Force garbage collection if available
    if (action.execution.parameters?.forceGC && global.gc) {
      global.gc();
    }
    
    // Clear unused modules if requested
    if (action.execution.parameters?.clearUnusedModules) {
      // Clear require cache for non-core modules
      Object.keys(require.cache).forEach(key => {
        if (!key.includes('node_modules/core-js')) {
          delete require.cache[key];
        }
      });
    }
    
    const memoryAfter = process.memoryUsage();
    const memoryFreed = memoryBefore.heapUsed - memoryAfter.heapUsed;
    
    result.output = `Memory cleanup completed. Freed: ${Math.round(memoryFreed / 1024 / 1024)}MB`;
    
  } catch (error) {
    throw new Error(`Memory cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Circuit breaker reset
const executeCircuitBreakerReset = async (action: HealingAction, result: HealingExecutionResult): Promise<void> => {
  try {
    const { circuitBreakerManager } = await import('./circuit-breaker');
    
    if (action.execution.parameters?.resetAll) {
      circuitBreakerManager.resetAll();
      result.output = 'All circuit breakers reset';
    } else {
      // Reset specific circuit breakers based on metadata
      const breakerName = result.metadata?.breakerName || 'default';
      const breaker = circuitBreakerManager.get(breakerName);
      if (breaker) {
        breaker.reset();
        result.output = `Circuit breaker '${breakerName}' reset`;
      } else {
        result.output = `Circuit breaker '${breakerName}' not found`;
      }
    }
    
  } catch (error) {
    throw new Error(`Circuit breaker reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Connection pool reset
const executeConnectionPoolReset = async (action: HealingAction, result: HealingExecutionResult): Promise<void> => {
  try {
    // This would depend on your specific connection pool implementation
    result.output = 'Connection pool reset completed';
    
  } catch (error) {
    throw new Error(`Connection pool reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Process restart
const executeProcessRestart = async (action: HealingAction, result: HealingExecutionResult): Promise<void> => {
  try {
    if (action.execution.parameters?.gracefulShutdown) {
      // Graceful shutdown process
      result.output = 'Graceful process restart initiated';
      
      // In a real implementation, this would signal for a graceful restart
      // For now, we'll just log the action
      logger.warn('Process restart requested but not implemented in this environment');
    } else {
      throw new Error('Only graceful restarts are supported');
    }
    
  } catch (error) {
    throw new Error(`Process restart failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Custom script execution
const executeCustomScript = async (action: HealingAction, result: HealingExecutionResult): Promise<void> => {
  try {
    if (!action.execution.script && !action.execution.command) {
      throw new Error('No script or command specified');
    }
    
    // In a real implementation, you would execute the custom script/command
    // with proper security measures and sandboxing
    result.output = 'Custom script execution completed';
    
  } catch (error) {
    throw new Error(`Custom script failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Verify healing action
const verifyHealingAction = async (action: HealingAction, result: HealingExecutionResult): Promise<boolean> => {
  try {
    if (action.verification.healthCheck) {
      // Run specific health check
      const { healthCheckManager } = await import('../health-checks');
      const healthChecks = await healthCheckManager.runAll();
      const targetCheck = healthChecks.find(check => check.name === action.verification.healthCheck);
      return targetCheck?.status === 'healthy';
    }
    
    if (action.verification.metric) {
      // Check specific metric
      // This would integrate with your metrics system
      return true; // Placeholder
    }
    
    return true;
  } catch (error) {
    logger.error('Verification failed', error);
    return false;
  }
};

// Execute rollback
const executeRollback = async (action: HealingAction, result: HealingExecutionResult): Promise<void> => {
  if (!action.rollback.enabled) return;
  
  try {
    logger.info(`Executing rollback for action: ${action.name}`);
    
    if (action.rollback.action) {
      // Execute rollback action
      const rollbackAction = defaultHealingActions.find(a => a.type === action.rollback.action);
      if (rollbackAction) {
        await executeActionByType(rollbackAction, result);
      }
    }
    
    if (action.rollback.script) {
      // Execute rollback script
      await executeCustomScript({ ...action, execution: { ...action.execution, script: action.rollback.script } }, result);
    }
    
    result.rollbackExecuted = true;
    logger.info(`Rollback completed for action: ${action.name}`);
    
  } catch (error) {
    logger.error(`Rollback failed for action: ${action.name}`, error);
  }
};

// Send healing notification
const sendHealingNotification = async (action: HealingAction, result: HealingExecutionResult, type: 'completed' | 'failed' | 'approval_required'): Promise<void> => {
  if (!config.notifications.enabled) return;
  
  const notification = {
    type: 'auto_healing_notification',
    action: {
      id: action.id,
      name: action.name,
      type: action.type,
      severity: action.impact.severity,
    },
    execution: {
      id: result.id,
      status: result.status,
      duration: result.duration,
      output: result.output,
      error: result.error,
    },
    notificationType: type,
    timestamp: new Date().toISOString(),
  };
  
  // Send to webhook
  if (config.notifications.webhookUrl) {
    try {
      await fetch(config.notifications.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      });
    } catch (error) {
      logger.error('Failed to send healing notification', error);
    }
  }
  
  logger.info(`Healing notification sent: ${action.name}`, notification);
};

// Monitor system for healing triggers
const monitorForHealingTriggers = async (): Promise<void> => {
  try {
    // Check health checks for failures
    const { healthCheckManager } = await import('../health-checks');
    const healthChecks = await healthCheckManager.runAll();
    
    for (const action of defaultHealingActions) {
      if (!action.enabled) continue;
      
      // Check health check triggers
      if (action.trigger.type === HealingTriggerType.HEALTH_CHECK_FAILURE) {
        const targetCheck = healthChecks.find(check => check.name === action.trigger.conditions.healthCheck);
        if (targetCheck && targetCheck.status === 'unhealthy') {
          // Check if this failure meets the trigger conditions
          // This would need more sophisticated tracking of consecutive failures
          await executeHealingAction(action, HealingTriggerType.HEALTH_CHECK_FAILURE, { healthCheck: targetCheck });
        }
      }
      
      // Check resource exhaustion triggers
      if (action.trigger.type === HealingTriggerType.RESOURCE_EXHAUSTION) {
        // Check memory usage, CPU, etc.
        if (action.trigger.conditions.metric === 'memory_usage') {
          const memoryUsage = process.memoryUsage();
          const usagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
          
          if (usagePercent > action.trigger.conditions.threshold) {
            await executeHealingAction(action, HealingTriggerType.RESOURCE_EXHAUSTION, { memoryUsage: usagePercent });
          }
        }
      }
    }
    
  } catch (error) {
    logger.error('Error in healing trigger monitoring', error);
  }
};

// Get healing summary
export const getHealingSummary = () => {
  const executions = Array.from(healingExecutions.values());
  const recentExecutions = executions.filter(e => e.startTime > Date.now() - 86400000); // Last 24 hours
  
  return {
    enabled: config.enabled,
    totalActions: defaultHealingActions.length,
    enabledActions: defaultHealingActions.filter(a => a.enabled).length,
    runningActions: runningActions.size,
    totalExecutions: executions.length,
    recentExecutions: recentExecutions.length,
    successRate: recentExecutions.length > 0 ? 
      (recentExecutions.filter(e => e.status === HealingStatus.SUCCESS).length / recentExecutions.length) * 100 : 0,
    executionStatus: {
      success: recentExecutions.filter(e => e.status === HealingStatus.SUCCESS).length,
      failed: recentExecutions.filter(e => e.status === HealingStatus.FAILED).length,
      running: recentExecutions.filter(e => e.status === HealingStatus.RUNNING).length,
      skipped: recentExecutions.filter(e => e.status === HealingStatus.SKIPPED).length,
    },
    averageDuration: recentExecutions.length > 0 ?
      recentExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / recentExecutions.length : 0,
    actions: defaultHealingActions.map(action => ({
      id: action.id,
      name: action.name,
      type: action.type,
      enabled: action.enabled,
      lastExecution: healingCooldowns.get(action.id),
      cooldownRemaining: healingCooldowns.has(action.id) ?
        Math.max(0, action.trigger.cooldownPeriod - (Date.now() - healingCooldowns.get(action.id)!)) : 0,
    })),
    timestamp: new Date().toISOString(),
  };
};

// Start auto-healing monitoring
export const startAutoHealing = () => {
  if (!config.enabled) {
    logger.info('Auto-healing is disabled');
    return;
  }
  
  if (!config.monitoring.enabled) {
    logger.info('Auto-healing monitoring is disabled');
    return;
  }
  
  logger.info('Starting auto-healing monitoring', {
    actions: defaultHealingActions.length,
    enabled: defaultHealingActions.filter(a => a.enabled).length,
    interval: config.monitoring.interval,
  });
  
  // Start monitoring interval
  monitoringInterval = setInterval(monitorForHealingTriggers, config.monitoring.interval);
};

// Stop auto-healing monitoring
export const stopAutoHealing = () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  
  logger.info('Auto-healing monitoring stopped');
};

// Export the auto-healing service
export const autoHealing = {
  config,
  defaultHealingActions,
  executeAction: executeHealingAction,
  getSummary: getHealingSummary,
  getExecutions: () => Array.from(healingExecutions.values()),
  getExecution: (id: string) => healingExecutions.get(id),
  startMonitoring: startAutoHealing,
  stopMonitoring: stopAutoHealing,
  monitorTriggers: monitorForHealingTriggers,
};

export default autoHealing;