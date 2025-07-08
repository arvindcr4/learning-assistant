/**
 * Chaos engineering and failure testing automation
 * Intentionally introduces controlled failures to test system resilience
 */
import { createLogger } from '../logger';
import { env } from '../env-validation';

const logger = createLogger('chaos-engineering');

// Chaos experiment types
export enum ChaosExperimentType {
  LATENCY_INJECTION = 'LATENCY_INJECTION',
  ERROR_INJECTION = 'ERROR_INJECTION',
  RESOURCE_EXHAUSTION = 'RESOURCE_EXHAUSTION',
  NETWORK_PARTITION = 'NETWORK_PARTITION',
  SERVICE_SHUTDOWN = 'SERVICE_SHUTDOWN',
  DATABASE_SLOWDOWN = 'DATABASE_SLOWDOWN',
  MEMORY_LEAK = 'MEMORY_LEAK',
  CPU_SPIKE = 'CPU_SPIKE',
  DISK_FULL = 'DISK_FULL',
  DEPENDENCY_FAILURE = 'DEPENDENCY_FAILURE'
}

// Chaos experiment status
export enum ChaosExperimentStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ABORTED = 'ABORTED',
  SCHEDULED = 'SCHEDULED'
}

// Chaos experiment scope
export enum ChaosScope {
  SINGLE_INSTANCE = 'SINGLE_INSTANCE',
  SUBSET = 'SUBSET',
  ALL_INSTANCES = 'ALL_INSTANCES',
  CANARY = 'CANARY'
}

// Chaos experiment definition
export interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  type: ChaosExperimentType;
  enabled: boolean;
  scope: ChaosScope;
  target: {
    service: string;
    component?: string;
    percentage?: number; // For subset/canary deployments
  };
  parameters: {
    duration: number; // milliseconds
    intensity: number; // 1-10 scale
    delay?: number; // latency in milliseconds
    errorRate?: number; // percentage
    resourceLimit?: number; // percentage or absolute value
    customParameters?: Record<string, any>;
  };
  schedule: {
    enabled: boolean;
    cronExpression?: string;
    interval?: number; // milliseconds
    randomDelay?: number; // max random delay in milliseconds
  };
  safeguards: {
    enabled: boolean;
    maxDuration: number; // maximum experiment duration
    healthCheckThreshold: number; // percentage of failed health checks to abort
    slaThreshold: number; // SLA compliance threshold to abort
    autoAbort: boolean;
    manualApprovalRequired: boolean;
  };
  monitoring: {
    enabled: boolean;
    metrics: string[]; // metrics to monitor during experiment
    alerts: string[]; // alert conditions
    baselineRequired: boolean;
  };
  rollback: {
    enabled: boolean;
    automatic: boolean;
    timeout: number;
  };
  environment: {
    production: boolean;
    staging: boolean;
    development: boolean;
  };
}

// Chaos experiment execution
export interface ChaosExperimentExecution {
  id: string;
  experimentId: string;
  status: ChaosExperimentStatus;
  startTime: number;
  endTime?: number;
  duration?: number;
  trigger: 'manual' | 'scheduled' | 'continuous';
  results: {
    systemHealth: Record<string, any>;
    performanceImpact: Record<string, any>;
    recoveryTime?: number;
    alertsTriggered: string[];
    incidentsCreated: string[];
    lessonsLearned: string[];
  };
  logs: ChaosExperimentLog[];
  metadata?: any;
}

// Chaos experiment log entry
export interface ChaosExperimentLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

// Chaos engineering configuration
interface ChaosEngineeringConfig {
  enabled: boolean;
  productionEnabled: boolean;
  maxConcurrentExperiments: number;
  defaultDuration: number;
  safeguards: {
    enabled: boolean;
    globalKillSwitch: boolean;
    healthCheckThreshold: number;
    slaThreshold: number;
    maxDuration: number;
  };
  monitoring: {
    enabled: boolean;
    interval: number;
    retentionDays: number;
  };
  notifications: {
    enabled: boolean;
    webhookUrl?: string;
    slackChannel?: string;
    emailRecipients?: string[];
  };
  scheduling: {
    enabled: boolean;
    businessHoursOnly: boolean;
    excludeWeekends: boolean;
    timezone: string;
  };
}

const config: ChaosEngineeringConfig = {
  enabled: process.env.ENABLE_CHAOS_ENGINEERING === 'true',
  productionEnabled: process.env.CHAOS_PRODUCTION_ENABLED === 'true',
  maxConcurrentExperiments: parseInt(process.env.CHAOS_MAX_CONCURRENT || '1'),
  defaultDuration: parseInt(process.env.CHAOS_DEFAULT_DURATION || '300000'), // 5 minutes
  safeguards: {
    enabled: process.env.CHAOS_SAFEGUARDS_ENABLED !== 'false',
    globalKillSwitch: process.env.CHAOS_GLOBAL_KILL_SWITCH === 'true',
    healthCheckThreshold: parseFloat(process.env.CHAOS_HEALTH_THRESHOLD || '20.0'),
    slaThreshold: parseFloat(process.env.CHAOS_SLA_THRESHOLD || '95.0'),
    maxDuration: parseInt(process.env.CHAOS_MAX_DURATION || '1800000'), // 30 minutes
  },
  monitoring: {
    enabled: process.env.CHAOS_MONITORING_ENABLED !== 'false',
    interval: parseInt(process.env.CHAOS_MONITORING_INTERVAL || '10000'), // 10 seconds
    retentionDays: parseInt(process.env.CHAOS_RETENTION_DAYS || '30'),
  },
  notifications: {
    enabled: process.env.CHAOS_NOTIFICATIONS_ENABLED === 'true',
    webhookUrl: process.env.CHAOS_WEBHOOK_URL,
    slackChannel: process.env.CHAOS_SLACK_CHANNEL,
    emailRecipients: process.env.CHAOS_EMAIL_RECIPIENTS?.split(',') || [],
  },
  scheduling: {
    enabled: process.env.CHAOS_SCHEDULING_ENABLED === 'true',
    businessHoursOnly: process.env.CHAOS_BUSINESS_HOURS_ONLY === 'true',
    excludeWeekends: process.env.CHAOS_EXCLUDE_WEEKENDS === 'true',
    timezone: process.env.CHAOS_TIMEZONE || 'UTC',
  },
};

// Predefined chaos experiments
export const defaultChaosExperiments: ChaosExperiment[] = [
  {
    id: 'database-latency-injection',
    name: 'Database Latency Injection',
    description: 'Inject latency into database queries to test application resilience',
    type: ChaosExperimentType.LATENCY_INJECTION,
    enabled: true,
    scope: ChaosScope.SINGLE_INSTANCE,
    target: {
      service: 'database',
      component: 'query_execution',
    },
    parameters: {
      duration: 300000, // 5 minutes
      intensity: 3,
      delay: 1000, // 1 second latency
    },
    schedule: {
      enabled: false,
    },
    safeguards: {
      enabled: true,
      maxDuration: 600000, // 10 minutes
      healthCheckThreshold: 30.0,
      slaThreshold: 95.0,
      autoAbort: true,
      manualApprovalRequired: false,
    },
    monitoring: {
      enabled: true,
      metrics: ['database_response_time', 'api_response_time', 'error_rate'],
      alerts: ['high_latency', 'increased_errors'],
      baselineRequired: true,
    },
    rollback: {
      enabled: true,
      automatic: true,
      timeout: 30000,
    },
    environment: {
      production: false,
      staging: true,
      development: true,
    },
  },
  {
    id: 'api-error-injection',
    name: 'API Error Injection',
    description: 'Randomly inject errors into API responses',
    type: ChaosExperimentType.ERROR_INJECTION,
    enabled: true,
    scope: ChaosScope.SUBSET,
    target: {
      service: 'api',
      percentage: 10, // 10% of requests
    },
    parameters: {
      duration: 180000, // 3 minutes
      intensity: 2,
      errorRate: 5.0, // 5% error rate
    },
    schedule: {
      enabled: false,
    },
    safeguards: {
      enabled: true,
      maxDuration: 300000, // 5 minutes
      healthCheckThreshold: 25.0,
      slaThreshold: 98.0,
      autoAbort: true,
      manualApprovalRequired: false,
    },
    monitoring: {
      enabled: true,
      metrics: ['error_rate', 'success_rate', 'user_sessions'],
      alerts: ['high_error_rate', 'user_impact'],
      baselineRequired: true,
    },
    rollback: {
      enabled: true,
      automatic: true,
      timeout: 10000,
    },
    environment: {
      production: false,
      staging: true,
      development: true,
    },
  },
  {
    id: 'memory-exhaustion',
    name: 'Memory Exhaustion',
    description: 'Gradually consume memory to test memory pressure handling',
    type: ChaosExperimentType.MEMORY_LEAK,
    enabled: false, // Disabled by default due to high impact
    scope: ChaosScope.SINGLE_INSTANCE,
    target: {
      service: 'application',
    },
    parameters: {
      duration: 600000, // 10 minutes
      intensity: 5,
      resourceLimit: 80, // 80% memory usage
    },
    schedule: {
      enabled: false,
    },
    safeguards: {
      enabled: true,
      maxDuration: 900000, // 15 minutes
      healthCheckThreshold: 15.0,
      slaThreshold: 90.0,
      autoAbort: true,
      manualApprovalRequired: true,
    },
    monitoring: {
      enabled: true,
      metrics: ['memory_usage', 'cpu_usage', 'response_time'],
      alerts: ['high_memory', 'performance_degradation'],
      baselineRequired: true,
    },
    rollback: {
      enabled: true,
      automatic: true,
      timeout: 60000,
    },
    environment: {
      production: false,
      staging: true,
      development: true,
    },
  },
  {
    id: 'external-dependency-failure',
    name: 'External Dependency Failure',
    description: 'Simulate external service failures to test circuit breakers',
    type: ChaosExperimentType.DEPENDENCY_FAILURE,
    enabled: true,
    scope: ChaosScope.ALL_INSTANCES,
    target: {
      service: 'external_api',
      component: 'tambo_ai',
    },
    parameters: {
      duration: 240000, // 4 minutes
      intensity: 4,
      errorRate: 100, // Complete failure
    },
    schedule: {
      enabled: false,
    },
    safeguards: {
      enabled: true,
      maxDuration: 480000, // 8 minutes
      healthCheckThreshold: 20.0,
      slaThreshold: 95.0,
      autoAbort: true,
      manualApprovalRequired: false,
    },
    monitoring: {
      enabled: true,
      metrics: ['circuit_breaker_state', 'fallback_usage', 'user_experience'],
      alerts: ['circuit_breaker_open', 'reduced_functionality'],
      baselineRequired: true,
    },
    rollback: {
      enabled: true,
      automatic: true,
      timeout: 15000,
    },
    environment: {
      production: false,
      staging: true,
      development: true,
    },
  },
  {
    id: 'cpu-spike',
    name: 'CPU Spike',
    description: 'Generate high CPU load to test performance under stress',
    type: ChaosExperimentType.CPU_SPIKE,
    enabled: true,
    scope: ChaosScope.SINGLE_INSTANCE,
    target: {
      service: 'application',
    },
    parameters: {
      duration: 120000, // 2 minutes
      intensity: 3,
      resourceLimit: 90, // 90% CPU usage
    },
    schedule: {
      enabled: false,
    },
    safeguards: {
      enabled: true,
      maxDuration: 300000, // 5 minutes
      healthCheckThreshold: 30.0,
      slaThreshold: 95.0,
      autoAbort: true,
      manualApprovalRequired: false,
    },
    monitoring: {
      enabled: true,
      metrics: ['cpu_usage', 'response_time', 'throughput'],
      alerts: ['high_cpu', 'performance_impact'],
      baselineRequired: true,
    },
    rollback: {
      enabled: true,
      automatic: true,
      timeout: 5000,
    },
    environment: {
      production: false,
      staging: true,
      development: true,
    },
  },
];

// Experiment execution state
const runningExperiments = new Map<string, ChaosExperimentExecution>();
const experimentHistory = new Map<string, ChaosExperimentExecution[]>();
const experimentSchedules = new Map<string, NodeJS.Timeout>();
let monitoringInterval: NodeJS.Timeout | null = null;

// Execute chaos experiment
export const executeChaosExperiment = async (experiment: ChaosExperiment, trigger: 'manual' | 'scheduled' | 'continuous' = 'manual'): Promise<ChaosExperimentExecution> => {
  const executionId = `${experiment.id}-${Date.now()}`;
  const startTime = Date.now();
  
  const execution: ChaosExperimentExecution = {
    id: executionId,
    experimentId: experiment.id,
    status: ChaosExperimentStatus.PENDING,
    startTime,
    trigger,
    results: {
      systemHealth: {},
      performanceImpact: {},
      alertsTriggered: [],
      incidentsCreated: [],
      lessonsLearned: [],
    },
    logs: [],
  };
  
  runningExperiments.set(executionId, execution);
  
  try {
    // Pre-execution checks
    await performPreExecutionChecks(experiment, execution);
    
    // Start experiment
    execution.status = ChaosExperimentStatus.RUNNING;
    addExperimentLog(execution, 'info', `Starting chaos experiment: ${experiment.name}`);
    
    logger.info(`Starting chaos experiment: ${experiment.name}`, {
      experimentId: experiment.id,
      executionId,
      type: experiment.type,
      duration: experiment.parameters.duration,
    });
    
    // Capture baseline metrics
    if (experiment.monitoring.baselineRequired) {
      await captureBaselineMetrics(experiment, execution);
    }
    
    // Execute the experiment
    await executeExperimentByType(experiment, execution);
    
    // Monitor during execution
    if (config.monitoring.enabled && experiment.monitoring.enabled) {
      await monitorExperimentExecution(experiment, execution);
    }
    
    // Wait for experiment duration
    await waitForExperimentCompletion(experiment, execution);
    
    // Stop experiment
    await stopExperiment(experiment, execution);
    
    execution.status = ChaosExperimentStatus.COMPLETED;
    addExperimentLog(execution, 'info', 'Chaos experiment completed successfully');
    
    logger.info(`Chaos experiment completed: ${experiment.name}`, {
      executionId,
      duration: execution.duration,
      status: execution.status,
    });
    
    // Send completion notification
    await sendChaosNotification(experiment, execution, 'completed');
    
  } catch (error) {
    execution.status = ChaosExperimentStatus.FAILED;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    addExperimentLog(execution, 'error', `Experiment failed: ${errorMessage}`);
    
    logger.error(`Chaos experiment failed: ${experiment.name}`, {
      executionId,
      error: errorMessage,
    });
    
    // Attempt cleanup
    try {
      await stopExperiment(experiment, execution);
    } catch (cleanupError) {
      addExperimentLog(execution, 'error', `Cleanup failed: ${cleanupError}`);
    }
    
    // Send failure notification
    await sendChaosNotification(experiment, execution, 'failed');
  } finally {
    // Finalize execution
    execution.endTime = Date.now();
    execution.duration = execution.endTime - execution.startTime;
    
    // Remove from running experiments
    runningExperiments.delete(executionId);
    
    // Add to history
    if (!experimentHistory.has(experiment.id)) {
      experimentHistory.set(experiment.id, []);
    }
    experimentHistory.get(experiment.id)!.push(execution);
    
    // Keep only recent history
    const history = experimentHistory.get(experiment.id)!;
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }
  
  return execution;
};

// Pre-execution checks
const performPreExecutionChecks = async (experiment: ChaosExperiment, execution: ChaosExperimentExecution): Promise<void> => {
  // Check if experiment is enabled
  if (!experiment.enabled) {
    throw new Error('Experiment is disabled');
  }
  
  // Check environment restrictions
  const isProduction = env.NODE_ENV === 'production';
  if (isProduction && !experiment.environment.production) {
    throw new Error('Experiment not allowed in production environment');
  }
  
  // Check global kill switch
  if (config.safeguards.globalKillSwitch) {
    throw new Error('Global chaos engineering kill switch is active');
  }
  
  // Check concurrent experiment limit
  if (runningExperiments.size >= config.maxConcurrentExperiments) {
    throw new Error('Maximum concurrent experiments limit reached');
  }
  
  // Check manual approval requirement
  if (experiment.safeguards.manualApprovalRequired) {
    // In a real implementation, this would check for approval
    addExperimentLog(execution, 'info', 'Manual approval required - proceeding in test mode');
  }
  
  // Check business hours if required
  if (config.scheduling.businessHoursOnly) {
    const now = new Date();
    const hour = now.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    
    if (config.scheduling.excludeWeekends && isWeekend) {
      throw new Error('Experiments not allowed on weekends');
    }
    
    if (hour < 9 || hour > 17) {
      throw new Error('Experiments only allowed during business hours');
    }
  }
  
  addExperimentLog(execution, 'info', 'Pre-execution checks passed');
};

// Capture baseline metrics
const captureBaselineMetrics = async (experiment: ChaosExperiment, execution: ChaosExperimentExecution): Promise<void> => {
  try {
    // Get current system health
    const { healthCheckManager } = await import('../health-checks');
    const healthChecks = await healthCheckManager.runAll();
    
    // Get performance metrics
    const { apm } = await import('../apm');
    const metrics = apm.getMetrics();
    
    execution.results.systemHealth.baseline = {
      healthChecks: healthChecks.map(hc => ({
        name: hc.name,
        status: hc.status,
        responseTime: hc.responseTime,
      })),
      metrics: {
        avgResponseTime: metrics.averageResponseTime,
        errorRate: (metrics.errors / Math.max(metrics.requests, 1)) * 100,
        memoryUsage: metrics.memoryUsage,
        cpuUsage: metrics.cpuUsage,
      },
      timestamp: Date.now(),
    };
    
    addExperimentLog(execution, 'info', 'Baseline metrics captured');
  } catch (error) {
    addExperimentLog(execution, 'warn', `Failed to capture baseline metrics: ${error}`);
  }
};

// Execute experiment by type
const executeExperimentByType = async (experiment: ChaosExperiment, execution: ChaosExperimentExecution): Promise<void> => {
  switch (experiment.type) {
    case ChaosExperimentType.LATENCY_INJECTION:
      await executeLatencyInjection(experiment, execution);
      break;
    case ChaosExperimentType.ERROR_INJECTION:
      await executeErrorInjection(experiment, execution);
      break;
    case ChaosExperimentType.MEMORY_LEAK:
      await executeMemoryExhaustion(experiment, execution);
      break;
    case ChaosExperimentType.CPU_SPIKE:
      await executeCPUSpike(experiment, execution);
      break;
    case ChaosExperimentType.DEPENDENCY_FAILURE:
      await executeDependencyFailure(experiment, execution);
      break;
    default:
      throw new Error(`Experiment type ${experiment.type} not implemented`);
  }
};

// Latency injection implementation
const executeLatencyInjection = async (experiment: ChaosExperiment, execution: ChaosExperimentExecution): Promise<void> => {
  addExperimentLog(execution, 'info', `Injecting ${experiment.parameters.delay}ms latency`);
  
  // In a real implementation, this would hook into your database/network layer
  // For demonstration, we'll simulate the impact
  execution.metadata = {
    injectedLatency: experiment.parameters.delay,
    targetComponent: experiment.target.component,
  };
};

// Error injection implementation
const executeErrorInjection = async (experiment: ChaosExperiment, execution: ChaosExperimentExecution): Promise<void> => {
  addExperimentLog(execution, 'info', `Injecting ${experiment.parameters.errorRate}% error rate`);
  
  // In a real implementation, this would hook into your API layer
  execution.metadata = {
    errorRate: experiment.parameters.errorRate,
    targetService: experiment.target.service,
  };
};

// Memory exhaustion implementation
const executeMemoryExhaustion = async (experiment: ChaosExperiment, execution: ChaosExperimentExecution): Promise<void> => {
  addExperimentLog(execution, 'info', `Consuming memory up to ${experiment.parameters.resourceLimit}%`);
  
  const targetMemory = (experiment.parameters.resourceLimit! / 100) * process.memoryUsage().heapTotal;
  const chunks: Buffer[] = [];
  
  try {
    // Gradually consume memory
    while (process.memoryUsage().heapUsed < targetMemory) {
      chunks.push(Buffer.alloc(1024 * 1024)); // 1MB chunks
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
      
      // Check if experiment should be aborted
      if (execution.status === ChaosExperimentStatus.ABORTED) {
        break;
      }
    }
    
    execution.metadata = {
      memoryConsumed: process.memoryUsage().heapUsed,
      chunks: chunks.length,
    };
    
  } catch (error) {
    addExperimentLog(execution, 'error', `Memory exhaustion failed: ${error}`);
    throw error;
  }
};

// CPU spike implementation
const executeCPUSpike = async (experiment: ChaosExperiment, execution: ChaosExperimentExecution): Promise<void> => {
  addExperimentLog(execution, 'info', `Generating CPU load up to ${experiment.parameters.resourceLimit}%`);
  
  const workers: NodeJS.Timeout[] = [];
  const numWorkers = require('os').cpus().length;
  
  try {
    // Start CPU-intensive workers
    for (let i = 0; i < numWorkers; i++) {
      const worker = setInterval(() => {
        // CPU-intensive calculation
        const start = Date.now();
        while (Date.now() - start < 50) {
          Math.random() * Math.random();
        }
      }, 100);
      
      workers.push(worker);
    }
    
    execution.metadata = {
      workers: workers.length,
      targetCPU: experiment.parameters.resourceLimit,
    };
    
  } catch (error) {
    // Cleanup workers
    workers.forEach(worker => clearInterval(worker));
    addExperimentLog(execution, 'error', `CPU spike failed: ${error}`);
    throw error;
  }
};

// Dependency failure implementation
const executeDependencyFailure = async (experiment: ChaosExperiment, execution: ChaosExperimentExecution): Promise<void> => {
  addExperimentLog(execution, 'info', `Simulating failure of ${experiment.target.component}`);
  
  // In a real implementation, this would use a service mesh or proxy to block traffic
  execution.metadata = {
    targetComponent: experiment.target.component,
    failureType: 'complete_failure',
  };
};

// Monitor experiment execution
const monitorExperimentExecution = async (experiment: ChaosExperiment, execution: ChaosExperimentExecution): Promise<void> => {
  const monitoringTimer = setInterval(async () => {
    try {
      // Check safeguards
      if (await shouldAbortExperiment(experiment, execution)) {
        execution.status = ChaosExperimentStatus.ABORTED;
        addExperimentLog(execution, 'warn', 'Experiment aborted due to safeguard trigger');
        clearInterval(monitoringTimer);
        return;
      }
      
      // Capture current metrics
      const { apm } = await import('../apm');
      const metrics = apm.getMetrics();
      
      execution.results.performanceImpact[Date.now()] = {
        avgResponseTime: metrics.averageResponseTime,
        errorRate: (metrics.errors / Math.max(metrics.requests, 1)) * 100,
        memoryUsage: metrics.memoryUsage,
        cpuUsage: metrics.cpuUsage,
      };
      
    } catch (error) {
      addExperimentLog(execution, 'error', `Monitoring error: ${error}`);
    }
  }, config.monitoring.interval);
  
  // Store timer for cleanup
  execution.metadata = { ...execution.metadata, monitoringTimer };
};

// Check if experiment should be aborted
const shouldAbortExperiment = async (experiment: ChaosExperiment, execution: ChaosExperimentExecution): Promise<boolean> => {
  if (!experiment.safeguards.enabled || !experiment.safeguards.autoAbort) {
    return false;
  }
  
  try {
    // Check health check threshold
    const { healthCheckManager } = await import('../health-checks');
    const healthChecks = await healthCheckManager.runAll();
    const unhealthyCount = healthChecks.filter(hc => hc.status === 'unhealthy').length;
    const unhealthyPercentage = (unhealthyCount / healthChecks.length) * 100;
    
    if (unhealthyPercentage > experiment.safeguards.healthCheckThreshold) {
      addExperimentLog(execution, 'warn', `Health check threshold breached: ${unhealthyPercentage}%`);
      return true;
    }
    
    // Check SLA threshold
    const { slaMonitoring } = await import('./sla-monitoring');
    const slaSummary = slaMonitoring.getSummary();
    
    if (slaSummary.overallCompliance < experiment.safeguards.slaThreshold) {
      addExperimentLog(execution, 'warn', `SLA threshold breached: ${slaSummary.overallCompliance}%`);
      return true;
    }
    
    // Check max duration
    const currentDuration = Date.now() - execution.startTime;
    if (currentDuration > experiment.safeguards.maxDuration) {
      addExperimentLog(execution, 'warn', `Max duration exceeded: ${currentDuration}ms`);
      return true;
    }
    
  } catch (error) {
    addExperimentLog(execution, 'error', `Safeguard check failed: ${error}`);
  }
  
  return false;
};

// Wait for experiment completion
const waitForExperimentCompletion = async (experiment: ChaosExperiment, execution: ChaosExperimentExecution): Promise<void> => {
  const duration = experiment.parameters.duration;
  const checkInterval = 1000; // Check every second
  let elapsed = 0;
  
  while (elapsed < duration && execution.status === ChaosExperimentStatus.RUNNING) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsed += checkInterval;
    
    // Check if experiment was aborted
    if (execution.status === ChaosExperimentStatus.ABORTED) {
      break;
    }
  }
};

// Stop experiment
const stopExperiment = async (experiment: ChaosExperiment, execution: ChaosExperimentExecution): Promise<void> => {
  try {
    // Cleanup based on experiment type
    if (execution.metadata?.monitoringTimer) {
      clearInterval(execution.metadata.monitoringTimer);
    }
    
    // Rollback if enabled
    if (experiment.rollback.enabled && experiment.rollback.automatic) {
      addExperimentLog(execution, 'info', 'Executing automatic rollback');
      // Implementation would depend on experiment type
    }
    
    addExperimentLog(execution, 'info', 'Experiment cleanup completed');
  } catch (error) {
    addExperimentLog(execution, 'error', `Cleanup failed: ${error}`);
  }
};

// Add log entry to experiment
const addExperimentLog = (execution: ChaosExperimentExecution, level: 'info' | 'warn' | 'error', message: string, data?: any): void => {
  execution.logs.push({
    timestamp: Date.now(),
    level,
    message,
    data,
  });
};

// Send chaos notification
const sendChaosNotification = async (experiment: ChaosExperiment, execution: ChaosExperimentExecution, type: 'started' | 'completed' | 'failed' | 'aborted'): Promise<void> => {
  if (!config.notifications.enabled) return;
  
  const notification = {
    type: 'chaos_experiment_notification',
    experiment: {
      id: experiment.id,
      name: experiment.name,
      type: experiment.type,
    },
    execution: {
      id: execution.id,
      status: execution.status,
      duration: execution.duration,
      trigger: execution.trigger,
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
      logger.error('Failed to send chaos notification', error);
    }
  }
  
  logger.info(`Chaos notification sent: ${experiment.name}`, notification);
};

// Get chaos engineering summary
export const getChaosEngineeringSummary = () => {
  const allExecutions = Array.from(experimentHistory.values()).flat();
  const recentExecutions = allExecutions.filter(e => e.startTime > Date.now() - 86400000); // Last 24 hours
  
  return {
    enabled: config.enabled,
    totalExperiments: defaultChaosExperiments.length,
    enabledExperiments: defaultChaosExperiments.filter(e => e.enabled).length,
    runningExperiments: runningExperiments.size,
    totalExecutions: allExecutions.length,
    recentExecutions: recentExecutions.length,
    successRate: recentExecutions.length > 0 ?
      (recentExecutions.filter(e => e.status === ChaosExperimentStatus.COMPLETED).length / recentExecutions.length) * 100 : 0,
    executionStatus: {
      completed: recentExecutions.filter(e => e.status === ChaosExperimentStatus.COMPLETED).length,
      failed: recentExecutions.filter(e => e.status === ChaosExperimentStatus.FAILED).length,
      aborted: recentExecutions.filter(e => e.status === ChaosExperimentStatus.ABORTED).length,
      running: recentExecutions.filter(e => e.status === ChaosExperimentStatus.RUNNING).length,
    },
    averageDuration: recentExecutions.length > 0 ?
      recentExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / recentExecutions.length : 0,
    experiments: defaultChaosExperiments.map(exp => ({
      id: exp.id,
      name: exp.name,
      type: exp.type,
      enabled: exp.enabled,
      lastExecution: experimentHistory.get(exp.id)?.[0]?.startTime,
    })),
    safeguards: {
      enabled: config.safeguards.enabled,
      globalKillSwitch: config.safeguards.globalKillSwitch,
    },
    timestamp: new Date().toISOString(),
  };
};

// Start chaos engineering
export const startChaosEngineering = () => {
  if (!config.enabled) {
    logger.info('Chaos engineering is disabled');
    return;
  }
  
  logger.info('Starting chaos engineering', {
    experiments: defaultChaosExperiments.length,
    enabled: defaultChaosExperiments.filter(e => e.enabled).length,
    productionEnabled: config.productionEnabled,
  });
};

// Stop chaos engineering
export const stopChaosEngineering = () => {
  // Abort all running experiments
  runningExperiments.forEach(execution => {
    execution.status = ChaosExperimentStatus.ABORTED;
    addExperimentLog(execution, 'warn', 'Experiment aborted due to system shutdown');
  });
  
  logger.info('Chaos engineering stopped');
};

// Export the chaos engineering service
export const chaosEngineering = {
  config,
  defaultChaosExperiments,
  executeExperiment: executeChaosExperiment,
  getSummary: getChaosEngineeringSummary,
  getRunningExperiments: () => Array.from(runningExperiments.values()),
  getExperimentHistory: (experimentId: string) => experimentHistory.get(experimentId) || [],
  getAllHistory: () => Object.fromEntries(experimentHistory),
  startMonitoring: startChaosEngineering,
  stopMonitoring: stopChaosEngineering,
};

export default chaosEngineering;