/**
 * Dependency health monitoring with external service checks
 * Monitors all external dependencies and detects cascade failures
 */
import { createLogger } from '../logger';
import { env } from '../env-validation';

const logger = createLogger('dependency-monitor');

// Dependency health result interface
export interface DependencyHealthResult {
  name: string;
  type: 'database' | 'cache' | 'api' | 'service' | 'storage' | 'cdn' | 'payment' | 'auth';
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  availability: number; // percentage
  responseTime: number;
  lastCheck: string;
  uptime: number; // percentage over last 24h
  errorRate: number; // percentage
  metadata: {
    endpoint?: string;
    version?: string;
    region?: string;
    provider?: string;
    lastError?: string;
    consecutiveFailures?: number;
    recoveryTime?: number;
  };
  dependencies: string[]; // Dependencies of this dependency
  impact: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedFeatures: string[];
    userImpact: string;
    businessImpact: string;
  };
  sla: {
    target: number;
    current: number;
    breached: boolean;
    timeToRecover?: number;
  };
}

// Dependency configuration
export interface DependencyConfig {
  name: string;
  type: 'database' | 'cache' | 'api' | 'service' | 'storage' | 'cdn' | 'payment' | 'auth';
  endpoint?: string;
  healthCheckUrl?: string;
  timeout: number;
  retries: number;
  checkInterval: number;
  critical: boolean;
  slaTarget: number; // percentage
  dependencies: string[];
  impact: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedFeatures: string[];
    userImpact: string;
    businessImpact: string;
  };
  healthCheck: {
    method: string;
    headers?: Record<string, string>;
    body?: any;
    expectedStatus?: number;
    expectedResponse?: string;
    timeout?: number;
  };
  alerting: {
    enabled: boolean;
    threshold: number; // consecutive failures before alerting
    escalation: boolean;
  };
}

// Dependency monitoring configuration
interface DependencyMonitoringConfig {
  enabled: boolean;
  checkInterval: number;
  defaultTimeout: number;
  defaultRetries: number;
  cascadeFailureThreshold: number; // percentage of dependencies that must fail
  slaMonitoringEnabled: boolean;
  alerting: {
    enabled: boolean;
    webhookUrl?: string;
    slackChannel?: string;
    emailRecipients?: string[];
  };
  recovery: {
    enabled: boolean;
    maxRecoveryAttempts: number;
    recoveryDelay: number;
  };
}

const config: DependencyMonitoringConfig = {
  enabled: process.env.ENABLE_DEPENDENCY_MONITORING !== 'false',
  checkInterval: parseInt(process.env.DEPENDENCY_CHECK_INTERVAL || '60000'), // 1 minute
  defaultTimeout: parseInt(process.env.DEPENDENCY_DEFAULT_TIMEOUT || '10000'),
  defaultRetries: parseInt(process.env.DEPENDENCY_DEFAULT_RETRIES || '3'),
  cascadeFailureThreshold: parseFloat(process.env.CASCADE_FAILURE_THRESHOLD || '30.0'),
  slaMonitoringEnabled: process.env.ENABLE_SLA_MONITORING === 'true',
  alerting: {
    enabled: process.env.DEPENDENCY_ALERTING_ENABLED === 'true',
    webhookUrl: process.env.DEPENDENCY_ALERT_WEBHOOK_URL,
    slackChannel: process.env.DEPENDENCY_ALERT_SLACK_CHANNEL,
    emailRecipients: process.env.DEPENDENCY_ALERT_EMAIL_RECIPIENTS?.split(',') || [],
  },
  recovery: {
    enabled: process.env.DEPENDENCY_RECOVERY_ENABLED === 'true',
    maxRecoveryAttempts: parseInt(process.env.DEPENDENCY_MAX_RECOVERY_ATTEMPTS || '5'),
    recoveryDelay: parseInt(process.env.DEPENDENCY_RECOVERY_DELAY || '30000'),
  },
};

// Dependency definitions for the learning assistant
export const dependencyConfigs: DependencyConfig[] = [
  {
    name: 'postgresql',
    type: 'database',
    endpoint: process.env.DATABASE_URL,
    timeout: 5000,
    retries: 3,
    checkInterval: 30000,
    critical: true,
    slaTarget: 99.9,
    dependencies: [],
    impact: {
      severity: 'critical',
      affectedFeatures: ['user_authentication', 'learning_progress', 'content_management', 'analytics'],
      userImpact: 'Complete service unavailable',
      businessImpact: 'Service completely down, no user interactions possible',
    },
    healthCheck: {
      method: 'query',
      expectedStatus: 200,
      timeout: 5000,
    },
    alerting: {
      enabled: true,
      threshold: 2,
      escalation: true,
    },
  },
  {
    name: 'redis',
    type: 'cache',
    endpoint: process.env.REDIS_URL,
    timeout: 3000,
    retries: 2,
    checkInterval: 60000,
    critical: false,
    slaTarget: 99.5,
    dependencies: [],
    impact: {
      severity: 'medium',
      affectedFeatures: ['session_management', 'caching', 'rate_limiting'],
      userImpact: 'Slower performance, may need to re-login',
      businessImpact: 'Degraded performance, increased database load',
    },
    healthCheck: {
      method: 'ping',
      expectedStatus: 200,
      timeout: 3000,
    },
    alerting: {
      enabled: true,
      threshold: 3,
      escalation: false,
    },
  },
  {
    name: 'supabase',
    type: 'service',
    endpoint: process.env.NEXT_PUBLIC_SUPABASE_URL,
    healthCheckUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
    timeout: 10000,
    retries: 3,
    checkInterval: 120000,
    critical: true,
    slaTarget: 99.9,
    dependencies: [],
    impact: {
      severity: 'critical',
      affectedFeatures: ['user_authentication', 'realtime_updates', 'file_storage'],
      userImpact: 'Cannot login, no real-time features',
      businessImpact: 'Authentication system down, user management unavailable',
    },
    healthCheck: {
      method: 'GET',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      expectedStatus: 200,
      timeout: 10000,
    },
    alerting: {
      enabled: true,
      threshold: 2,
      escalation: true,
    },
  },
  {
    name: 'tambo_ai',
    type: 'api',
    endpoint: 'https://api.tambo.ai',
    healthCheckUrl: 'https://api.tambo.ai/v1/health',
    timeout: 15000,
    retries: 3,
    checkInterval: 300000, // 5 minutes
    critical: false,
    slaTarget: 99.0,
    dependencies: [],
    impact: {
      severity: 'medium',
      affectedFeatures: ['ai_content_generation', 'personalized_learning'],
      userImpact: 'AI features unavailable, basic learning still works',
      businessImpact: 'AI-powered features down, reduced user engagement',
    },
    healthCheck: {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.TAMBO_API_KEY}`,
      },
      expectedStatus: 200,
      timeout: 15000,
    },
    alerting: {
      enabled: true,
      threshold: 3,
      escalation: false,
    },
  },
  {
    name: 'resend',
    type: 'service',
    endpoint: 'https://api.resend.com',
    healthCheckUrl: 'https://api.resend.com/domains',
    timeout: 10000,
    retries: 2,
    checkInterval: 600000, // 10 minutes
    critical: false,
    slaTarget: 99.5,
    dependencies: [],
    impact: {
      severity: 'low',
      affectedFeatures: ['email_notifications', 'password_reset'],
      userImpact: 'No email notifications, password reset unavailable',
      businessImpact: 'Email communications down, user onboarding impacted',
    },
    healthCheck: {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      expectedStatus: 200,
      timeout: 10000,
    },
    alerting: {
      enabled: true,
      threshold: 5,
      escalation: false,
    },
  },
  {
    name: 'cdn',
    type: 'cdn',
    endpoint: process.env.CDN_URL || 'https://cdn.example.com',
    healthCheckUrl: `${process.env.CDN_URL || 'https://cdn.example.com'}/health`,
    timeout: 5000,
    retries: 2,
    checkInterval: 300000, // 5 minutes
    critical: false,
    slaTarget: 99.9,
    dependencies: [],
    impact: {
      severity: 'low',
      affectedFeatures: ['static_assets', 'media_delivery'],
      userImpact: 'Slower page loads, images may not load',
      businessImpact: 'Degraded user experience, increased server load',
    },
    healthCheck: {
      method: 'GET',
      expectedStatus: 200,
      timeout: 5000,
    },
    alerting: {
      enabled: true,
      threshold: 5,
      escalation: false,
    },
  },
];

// Dependency health results storage
const dependencyResults = new Map<string, DependencyHealthResult[]>();
const dependencySchedules = new Map<string, NodeJS.Timeout>();
const dependencyStatus = new Map<string, DependencyHealthResult>();

// Helper function to calculate uptime percentage
const calculateUptime = (results: DependencyHealthResult[], hours = 24): number => {
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  const relevantResults = results.filter(r => new Date(r.lastCheck).getTime() > cutoff);
  
  if (relevantResults.length === 0) return 100;
  
  const healthyResults = relevantResults.filter(r => r.status === 'healthy').length;
  return (healthyResults / relevantResults.length) * 100;
};

// Helper function to calculate error rate
const calculateErrorRate = (results: DependencyHealthResult[], hours = 1): number => {
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  const relevantResults = results.filter(r => new Date(r.lastCheck).getTime() > cutoff);
  
  if (relevantResults.length === 0) return 0;
  
  const errorResults = relevantResults.filter(r => r.status === 'unhealthy').length;
  return (errorResults / relevantResults.length) * 100;
};

// Execute health check for a dependency
const checkDependencyHealth = async (dependency: DependencyConfig): Promise<DependencyHealthResult> => {
  const startTime = Date.now();
  const result: DependencyHealthResult = {
    name: dependency.name,
    type: dependency.type,
    status: 'unknown',
    availability: 0,
    responseTime: 0,
    lastCheck: new Date().toISOString(),
    uptime: 0,
    errorRate: 0,
    metadata: {
      endpoint: dependency.endpoint,
      consecutiveFailures: 0,
    },
    dependencies: dependency.dependencies,
    impact: dependency.impact,
    sla: {
      target: dependency.slaTarget,
      current: 0,
      breached: false,
    },
  };

  try {
    // Get previous results for trend analysis
    const previousResults = dependencyResults.get(dependency.name) || [];
    
    if (dependency.type === 'database' && dependency.name === 'postgresql') {
      // Database health check
      const { db } = await import('../database');
      const queryStart = Date.now();
      await db.query('SELECT 1 as health_check');
      result.responseTime = Date.now() - queryStart;
      result.status = 'healthy';
      result.availability = 100;
      
    } else if (dependency.type === 'cache' && dependency.name === 'redis') {
      // Redis health check
      if (dependency.endpoint) {
        const { createClient } = await import('redis');
        const client = createClient({ url: dependency.endpoint });
        await client.connect();
        const pingStart = Date.now();
        await client.ping();
        result.responseTime = Date.now() - pingStart;
        await client.disconnect();
        result.status = 'healthy';
        result.availability = 100;
      } else {
        result.status = 'healthy';
        result.availability = 100;
        result.responseTime = 0;
        result.metadata.lastError = 'Redis not configured';
      }
      
    } else if (dependency.healthCheckUrl) {
      // HTTP health check
      const response = await fetch(dependency.healthCheckUrl, {
        method: dependency.healthCheck.method,
        headers: dependency.healthCheck.headers || {},
        body: dependency.healthCheck.body ? JSON.stringify(dependency.healthCheck.body) : undefined,
        signal: AbortSignal.timeout(dependency.timeout),
      });
      
      result.responseTime = Date.now() - startTime;
      result.metadata.endpoint = dependency.healthCheckUrl;
      
      if (response.ok) {
        result.status = 'healthy';
        result.availability = 100;
        
        // Check response time thresholds
        if (result.responseTime > dependency.timeout * 0.8) {
          result.status = 'degraded';
          result.availability = 85;
        }
      } else {
        result.status = 'unhealthy';
        result.availability = 0;
        result.metadata.lastError = `HTTP ${response.status}: ${response.statusText}`;
      }
    }
    
    // Calculate historical metrics
    result.uptime = calculateUptime(previousResults);
    result.errorRate = calculateErrorRate(previousResults);
    
    // Check SLA
    result.sla.current = result.uptime;
    result.sla.breached = result.uptime < dependency.slaTarget;
    
    // Update consecutive failures
    const lastResult = dependencyStatus.get(dependency.name);
    if (result.status === 'unhealthy') {
      result.metadata.consecutiveFailures = (lastResult?.metadata.consecutiveFailures || 0) + 1;
    } else {
      result.metadata.consecutiveFailures = 0;
      if (lastResult?.status === 'unhealthy') {
        result.metadata.recoveryTime = Date.now() - new Date(lastResult.lastCheck).getTime();
      }
    }
    
    logger.info(`Dependency health check completed: ${dependency.name}`, {
      status: result.status,
      responseTime: result.responseTime,
      availability: result.availability,
      uptime: result.uptime,
    });
    
  } catch (error) {
    result.status = 'unhealthy';
    result.availability = 0;
    result.responseTime = Date.now() - startTime;
    result.metadata.lastError = error instanceof Error ? error.message : 'Unknown error';
    
    const lastResult = dependencyStatus.get(dependency.name);
    result.metadata.consecutiveFailures = (lastResult?.metadata.consecutiveFailures || 0) + 1;
    
    logger.error(`Dependency health check failed: ${dependency.name}`, error);
  }

  return result;
};

// Check for cascade failures
const checkCascadeFailures = (): { detected: boolean; failedDependencies: string[]; impact: string } => {
  const allDependencies = Array.from(dependencyStatus.values());
  const criticalDependencies = allDependencies.filter(d => 
    dependencyConfigs.find(c => c.name === d.name)?.critical
  );
  const failedDependencies = allDependencies.filter(d => d.status === 'unhealthy');
  const failedCritical = criticalDependencies.filter(d => d.status === 'unhealthy');
  
  const failureRate = (failedDependencies.length / allDependencies.length) * 100;
  const criticalFailureRate = criticalDependencies.length > 0 ? 
    (failedCritical.length / criticalDependencies.length) * 100 : 0;
  
  const cascadeDetected = failureRate > config.cascadeFailureThreshold || 
                         criticalFailureRate > 0;
  
  let impact = 'none';
  if (cascadeDetected) {
    if (criticalFailureRate > 0) {
      impact = 'critical';
    } else if (failureRate > 50) {
      impact = 'high';
    } else {
      impact = 'medium';
    }
  }
  
  return {
    detected: cascadeDetected,
    failedDependencies: failedDependencies.map(d => d.name),
    impact,
  };
};

// Send dependency alert
const sendDependencyAlert = async (dependency: DependencyConfig, result: DependencyHealthResult, alertType: 'failure' | 'recovery' | 'sla_breach' | 'cascade') => {
  if (!config.alerting.enabled) return;
  
  const alert = {
    type: 'dependency_alert',
    alertType,
    dependency: dependency.name,
    status: result.status,
    responseTime: result.responseTime,
    availability: result.availability,
    uptime: result.uptime,
    consecutiveFailures: result.metadata.consecutiveFailures,
    impact: result.impact,
    sla: result.sla,
    timestamp: result.lastCheck,
  };
  
  // Send to webhook
  if (config.alerting.webhookUrl) {
    try {
      await fetch(config.alerting.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      logger.error('Failed to send dependency alert', error);
    }
  }
  
  logger.warn(`Dependency alert sent: ${dependency.name}`, alert);
};

// Schedule dependency monitoring
export const scheduleDependencyMonitoring = (dependency: DependencyConfig) => {
  if (!config.enabled) return;
  
  // Clear existing schedule
  if (dependencySchedules.has(dependency.name)) {
    clearInterval(dependencySchedules.get(dependency.name)!);
  }
  
  // Schedule new interval
  const interval = setInterval(async () => {
    try {
      const result = await checkDependencyHealth(dependency);
      
      // Store result
      if (!dependencyResults.has(dependency.name)) {
        dependencyResults.set(dependency.name, []);
      }
      const results = dependencyResults.get(dependency.name)!;
      results.push(result);
      
      // Keep only recent results
      if (results.length > 1000) {
        results.splice(0, results.length - 1000);
      }
      
      // Update current status
      const previousStatus = dependencyStatus.get(dependency.name);
      dependencyStatus.set(dependency.name, result);
      
      // Send alerts
      if (result.status === 'unhealthy' && 
          result.metadata.consecutiveFailures === dependency.alerting.threshold) {
        await sendDependencyAlert(dependency, result, 'failure');
      } else if (result.status === 'healthy' && 
                 previousStatus?.status === 'unhealthy') {
        await sendDependencyAlert(dependency, result, 'recovery');
      } else if (result.sla.breached && !previousStatus?.sla.breached) {
        await sendDependencyAlert(dependency, result, 'sla_breach');
      }
      
      // Check for cascade failures
      const cascadeCheck = checkCascadeFailures();
      if (cascadeCheck.detected && cascadeCheck.impact === 'critical') {
        await sendDependencyAlert(dependency, result, 'cascade');
      }
      
    } catch (error) {
      logger.error(`Failed to check dependency health: ${dependency.name}`, error);
    }
  }, dependency.checkInterval);
  
  dependencySchedules.set(dependency.name, interval);
  
  logger.info(`Scheduled dependency monitoring: ${dependency.name}`, {
    interval: dependency.checkInterval,
    critical: dependency.critical,
    slaTarget: dependency.slaTarget,
  });
};

// Get dependency monitoring summary
export const getDependencyMonitoringSummary = () => {
  const allDependencies = Array.from(dependencyStatus.values());
  const criticalDependencies = allDependencies.filter(d => 
    dependencyConfigs.find(c => c.name === d.name)?.critical
  );
  
  const summary = {
    enabled: config.enabled,
    totalDependencies: dependencyConfigs.length,
    monitoredDependencies: dependencySchedules.size,
    criticalDependencies: criticalDependencies.length,
    healthyDependencies: allDependencies.filter(d => d.status === 'healthy').length,
    degradedDependencies: allDependencies.filter(d => d.status === 'degraded').length,
    unhealthyDependencies: allDependencies.filter(d => d.status === 'unhealthy').length,
    overallHealth: {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      score: 100,
      message: 'All dependencies healthy',
    },
    cascadeFailure: checkCascadeFailures(),
    slaBreaches: allDependencies.filter(d => d.sla.breached).length,
    dependencies: Object.fromEntries(
      allDependencies.map(d => [d.name, {
        status: d.status,
        availability: d.availability,
        responseTime: d.responseTime,
        uptime: d.uptime,
        errorRate: d.errorRate,
        lastCheck: d.lastCheck,
        impact: d.impact,
        sla: d.sla,
      }])
    ),
    timestamp: new Date().toISOString(),
  };
  
  // Calculate overall health score
  if (allDependencies.length > 0) {
    const healthyCount = summary.healthyDependencies;
    const degradedCount = summary.degradedDependencies;
    const unhealthyCount = summary.unhealthyDependencies;
    
    // Weight critical dependencies more heavily
    const criticalHealthy = criticalDependencies.filter(d => d.status === 'healthy').length;
    const criticalUnhealthy = criticalDependencies.filter(d => d.status === 'unhealthy').length;
    
    if (criticalUnhealthy > 0) {
      summary.overallHealth.status = 'unhealthy';
      summary.overallHealth.score = Math.max(0, 100 - (criticalUnhealthy * 50) - (unhealthyCount * 10));
      summary.overallHealth.message = `${criticalUnhealthy} critical dependencies down`;
    } else if (unhealthyCount > 0) {
      summary.overallHealth.status = 'degraded';
      summary.overallHealth.score = Math.max(0, 100 - (unhealthyCount * 20) - (degradedCount * 5));
      summary.overallHealth.message = `${unhealthyCount} dependencies unhealthy`;
    } else if (degradedCount > 0) {
      summary.overallHealth.status = 'degraded';
      summary.overallHealth.score = Math.max(0, 100 - (degradedCount * 10));
      summary.overallHealth.message = `${degradedCount} dependencies degraded`;
    }
  }
  
  return summary;
};

// Start dependency monitoring
export const startDependencyMonitoring = () => {
  if (!config.enabled) {
    logger.info('Dependency monitoring is disabled');
    return;
  }
  
  logger.info('Starting dependency monitoring', {
    dependencies: dependencyConfigs.length,
    checkInterval: config.checkInterval,
  });
  
  // Schedule monitoring for all dependencies
  dependencyConfigs.forEach(dependency => {
    scheduleDependencyMonitoring(dependency);
  });
};

// Stop dependency monitoring
export const stopDependencyMonitoring = () => {
  dependencySchedules.forEach((interval, dependencyName) => {
    clearInterval(interval);
    logger.info(`Stopped dependency monitoring: ${dependencyName}`);
  });
  
  dependencySchedules.clear();
  logger.info('Dependency monitoring stopped');
};

// Export the dependency monitoring service
export const dependencyMonitoring = {
  config,
  dependencyConfigs,
  startMonitoring: startDependencyMonitoring,
  stopMonitoring: stopDependencyMonitoring,
  getSummary: getDependencyMonitoringSummary,
  getResults: (dependencyName: string) => dependencyResults.get(dependencyName) || [],
  getCurrentStatus: (dependencyName: string) => dependencyStatus.get(dependencyName),
  getAllResults: () => Object.fromEntries(dependencyResults),
  getAllCurrentStatus: () => Object.fromEntries(dependencyStatus),
  checkCascadeFailures,
  scheduleDependency: scheduleDependencyMonitoring,
  checkHealth: checkDependencyHealth,
};

export default dependencyMonitoring;