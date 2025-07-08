/**
 * Synthetic monitoring with realistic user journey testing
 * Simulates real user interactions to detect issues before users encounter them
 */
import { createLogger } from '../logger';
import { env } from '../env-validation';

const logger = createLogger('synthetic-monitoring');

// Synthetic test result interface
export interface SyntheticTestResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  duration: number;
  timestamp: string;
  steps: SyntheticStepResult[];
  metrics: {
    totalDuration: number;
    successRate: number;
    errorRate: number;
    avgResponseTime: number;
    slowestStep?: string;
    failedSteps: string[];
  };
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface SyntheticStepResult {
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  duration: number;
  url?: string;
  method?: string;
  statusCode?: number;
  responseSize?: number;
  error?: string;
  metadata?: any;
}

// Journey configuration
export interface SyntheticJourney {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  critical: boolean;
  steps: SyntheticStep[];
  schedule: {
    interval: number; // milliseconds
    timezone?: string;
  };
  thresholds: {
    maxDuration: number;
    maxErrorRate: number;
    maxResponseTime: number;
  };
  alerting: {
    onFailure: boolean;
    onSlowResponse: boolean;
    onHighErrorRate: boolean;
  };
}

export interface SyntheticStep {
  name: string;
  type: 'http' | 'click' | 'form' | 'wait' | 'assertion';
  config: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    selector?: string;
    value?: string;
    timeout?: number;
    retries?: number;
    assertion?: {
      type: 'status' | 'text' | 'element' | 'response_time';
      expected: any;
      operator?: 'equals' | 'contains' | 'greater' | 'less';
    };
  };
  critical: boolean;
}

// Synthetic monitoring configuration
interface SyntheticMonitoringConfig {
  enabled: boolean;
  baseUrl: string;
  defaultTimeout: number;
  defaultRetries: number;
  concurrentJourneys: number;
  userAgent: string;
  thresholds: {
    journeyDuration: number;
    stepDuration: number;
    errorRate: number;
  };
  alerting: {
    enabled: boolean;
    webhookUrl?: string;
    slackChannel?: string;
  };
  reporting: {
    enabled: boolean;
    retentionDays: number;
    aggregationInterval: number;
  };
}

const config: SyntheticMonitoringConfig = {
  enabled: process.env.ENABLE_SYNTHETIC_MONITORING === 'true',
  baseUrl: process.env.SYNTHETIC_BASE_URL || 'http://localhost:3000',
  defaultTimeout: parseInt(process.env.SYNTHETIC_DEFAULT_TIMEOUT || '30000'),
  defaultRetries: parseInt(process.env.SYNTHETIC_DEFAULT_RETRIES || '2'),
  concurrentJourneys: parseInt(process.env.SYNTHETIC_CONCURRENT_JOURNEYS || '3'),
  userAgent: process.env.SYNTHETIC_USER_AGENT || 'LearningAssistant-SyntheticMonitor/1.0',
  thresholds: {
    journeyDuration: parseInt(process.env.SYNTHETIC_JOURNEY_DURATION_THRESHOLD || '30000'),
    stepDuration: parseInt(process.env.SYNTHETIC_STEP_DURATION_THRESHOLD || '5000'),
    errorRate: parseFloat(process.env.SYNTHETIC_ERROR_RATE_THRESHOLD || '5.0'),
  },
  alerting: {
    enabled: process.env.SYNTHETIC_ALERTING_ENABLED === 'true',
    webhookUrl: process.env.SYNTHETIC_ALERT_WEBHOOK_URL,
    slackChannel: process.env.SYNTHETIC_ALERT_SLACK_CHANNEL,
  },
  reporting: {
    enabled: process.env.SYNTHETIC_REPORTING_ENABLED === 'true',
    retentionDays: parseInt(process.env.SYNTHETIC_REPORTING_RETENTION_DAYS || '30'),
    aggregationInterval: parseInt(process.env.SYNTHETIC_REPORTING_AGGREGATION_INTERVAL || '300000'), // 5 minutes
  },
};

// Test results storage
const testResults = new Map<string, SyntheticTestResult[]>();
const journeySchedules = new Map<string, NodeJS.Timeout>();

// Predefined user journeys for the learning assistant
export const defaultJourneys: SyntheticJourney[] = [
  {
    id: 'user-registration-journey',
    name: 'User Registration Journey',
    description: 'Test complete user registration flow',
    enabled: true,
    critical: true,
    steps: [
      {
        name: 'Load homepage',
        type: 'http',
        config: {
          url: '/',
          method: 'GET',
          timeout: 5000,
          assertion: {
            type: 'status',
            expected: 200,
            operator: 'equals',
          },
        },
        critical: true,
      },
      {
        name: 'Navigate to registration',
        type: 'http',
        config: {
          url: '/register',
          method: 'GET',
          timeout: 5000,
          assertion: {
            type: 'status',
            expected: 200,
            operator: 'equals',
          },
        },
        critical: true,
      },
      {
        name: 'Submit registration form',
        type: 'http',
        config: {
          url: '/api/auth/register',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            email: `synthetic-test-${Date.now()}@example.com`,
            password: 'TestPassword123!',
            name: 'Synthetic Test User',
          },
          timeout: 10000,
          assertion: {
            type: 'status',
            expected: 201,
            operator: 'equals',
          },
        },
        critical: true,
      },
    ],
    schedule: {
      interval: 300000, // 5 minutes
    },
    thresholds: {
      maxDuration: 20000,
      maxErrorRate: 2.0,
      maxResponseTime: 5000,
    },
    alerting: {
      onFailure: true,
      onSlowResponse: true,
      onHighErrorRate: true,
    },
  },
  {
    id: 'learning-session-journey',
    name: 'Learning Session Journey',
    description: 'Test complete learning session workflow',
    enabled: true,
    critical: true,
    steps: [
      {
        name: 'Load dashboard',
        type: 'http',
        config: {
          url: '/dashboard',
          method: 'GET',
          timeout: 5000,
          assertion: {
            type: 'status',
            expected: 200,
            operator: 'equals',
          },
        },
        critical: true,
      },
      {
        name: 'Start learning session',
        type: 'http',
        config: {
          url: '/api/learning/session',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            contentType: 'quiz',
            difficulty: 'medium',
            duration: 300,
          },
          timeout: 10000,
          assertion: {
            type: 'status',
            expected: 201,
            operator: 'equals',
          },
        },
        critical: true,
      },
      {
        name: 'Get recommendations',
        type: 'http',
        config: {
          url: '/api/learning/recommendations',
          method: 'GET',
          timeout: 5000,
          assertion: {
            type: 'status',
            expected: 200,
            operator: 'equals',
          },
        },
        critical: false,
      },
    ],
    schedule: {
      interval: 600000, // 10 minutes
    },
    thresholds: {
      maxDuration: 25000,
      maxErrorRate: 1.0,
      maxResponseTime: 3000,
    },
    alerting: {
      onFailure: true,
      onSlowResponse: true,
      onHighErrorRate: true,
    },
  },
  {
    id: 'api-health-journey',
    name: 'API Health Journey',
    description: 'Test core API endpoints health',
    enabled: true,
    critical: true,
    steps: [
      {
        name: 'Health check endpoint',
        type: 'http',
        config: {
          url: '/api/health',
          method: 'GET',
          timeout: 5000,
          assertion: {
            type: 'status',
            expected: 200,
            operator: 'equals',
          },
        },
        critical: true,
      },
      {
        name: 'CSRF token endpoint',
        type: 'http',
        config: {
          url: '/api/csrf',
          method: 'GET',
          timeout: 3000,
          assertion: {
            type: 'status',
            expected: 200,
            operator: 'equals',
          },
        },
        critical: true,
      },
      {
        name: 'Learning analytics endpoint',
        type: 'http',
        config: {
          url: '/api/learning/analytics',
          method: 'GET',
          timeout: 5000,
          assertion: {
            type: 'status',
            expected: 200,
            operator: 'equals',
          },
        },
        critical: false,
      },
    ],
    schedule: {
      interval: 120000, // 2 minutes
    },
    thresholds: {
      maxDuration: 15000,
      maxErrorRate: 0.5,
      maxResponseTime: 2000,
    },
    alerting: {
      onFailure: true,
      onSlowResponse: false,
      onHighErrorRate: true,
    },
  },
  {
    id: 'performance-journey',
    name: 'Performance Journey',
    description: 'Test application performance under load',
    enabled: true,
    critical: false,
    steps: [
      {
        name: 'Load test - homepage',
        type: 'http',
        config: {
          url: '/',
          method: 'GET',
          timeout: 3000,
          assertion: {
            type: 'response_time',
            expected: 2000,
            operator: 'less',
          },
        },
        critical: false,
      },
      {
        name: 'Load test - dashboard',
        type: 'http',
        config: {
          url: '/dashboard',
          method: 'GET',
          timeout: 5000,
          assertion: {
            type: 'response_time',
            expected: 3000,
            operator: 'less',
          },
        },
        critical: false,
      },
      {
        name: 'Load test - API response',
        type: 'http',
        config: {
          url: '/api/learning/content',
          method: 'GET',
          timeout: 5000,
          assertion: {
            type: 'response_time',
            expected: 2000,
            operator: 'less',
          },
        },
        critical: false,
      },
    ],
    schedule: {
      interval: 900000, // 15 minutes
    },
    thresholds: {
      maxDuration: 10000,
      maxErrorRate: 10.0,
      maxResponseTime: 3000,
    },
    alerting: {
      onFailure: false,
      onSlowResponse: true,
      onHighErrorRate: false,
    },
  },
];

// Execute a single synthetic step
const executeStep = async (step: SyntheticStep, baseUrl: string): Promise<SyntheticStepResult> => {
  const startTime = Date.now();
  const result: SyntheticStepResult = {
    name: step.name,
    status: 'skipped',
    duration: 0,
  };

  try {
    const timeout = step.config.timeout || config.defaultTimeout;
    const retries = step.config.retries || config.defaultRetries;
    
    let lastError: Error | null = null;
    
    // Retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (step.type === 'http') {
          const url = step.config.url?.startsWith('http') 
            ? step.config.url 
            : `${baseUrl}${step.config.url}`;
          
          const response = await fetch(url, {
            method: step.config.method || 'GET',
            headers: {
              'User-Agent': config.userAgent,
              ...step.config.headers,
            },
            body: step.config.body ? JSON.stringify(step.config.body) : undefined,
            signal: AbortSignal.timeout(timeout),
          });

          result.url = url;
          result.method = step.config.method || 'GET';
          result.statusCode = response.status;
          result.responseSize = parseInt(response.headers.get('content-length') || '0');
          
          // Check assertions
          if (step.config.assertion) {
            const assertion = step.config.assertion;
            let assertionPassed = false;
            
            switch (assertion.type) {
              case 'status':
                assertionPassed = assertion.operator === 'equals' 
                  ? response.status === assertion.expected
                  : response.status !== assertion.expected;
                break;
              case 'response_time':
                const responseTime = Date.now() - startTime;
                assertionPassed = assertion.operator === 'less' 
                  ? responseTime < assertion.expected
                  : responseTime > assertion.expected;
                break;
              case 'text':
                const responseText = await response.text();
                assertionPassed = assertion.operator === 'contains' 
                  ? responseText.includes(assertion.expected)
                  : responseText === assertion.expected;
                break;
            }
            
            if (!assertionPassed) {
              throw new Error(`Assertion failed: ${assertion.type} ${assertion.operator} ${assertion.expected}`);
            }
          }
          
          result.status = response.ok ? 'passed' : 'failed';
          if (!response.ok) {
            result.error = `HTTP ${response.status}: ${response.statusText}`;
          }
          
          break; // Success, exit retry loop
        } else if (step.type === 'wait') {
          const waitTime = step.config.timeout || 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          result.status = 'passed';
          break;
        } else {
          result.status = 'skipped';
          result.error = `Step type '${step.type}' not implemented`;
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === retries) {
          result.status = 'failed';
          result.error = lastError.message;
        }
        // Wait before retry
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
  } catch (error) {
    result.status = 'failed';
    result.error = error instanceof Error ? error.message : 'Unknown error';
  }

  result.duration = Date.now() - startTime;
  return result;
};

// Execute a synthetic journey
export const executeJourney = async (journey: SyntheticJourney): Promise<SyntheticTestResult> => {
  const startTime = Date.now();
  const result: SyntheticTestResult = {
    id: journey.id,
    name: journey.name,
    status: 'passed',
    duration: 0,
    timestamp: new Date().toISOString(),
    steps: [],
    metrics: {
      totalDuration: 0,
      successRate: 0,
      errorRate: 0,
      avgResponseTime: 0,
      failedSteps: [],
    },
    errors: [],
    warnings: [],
    recommendations: [],
  };

  try {
    logger.info(`Starting synthetic journey: ${journey.name}`);
    
    // Execute all steps
    for (const step of journey.steps) {
      const stepResult = await executeStep(step, config.baseUrl);
      result.steps.push(stepResult);
      
      // Track failures
      if (stepResult.status === 'failed') {
        result.metrics.failedSteps.push(stepResult.name);
        result.errors.push(`Step '${stepResult.name}' failed: ${stepResult.error}`);
        
        // Stop if critical step fails
        if (step.critical) {
          result.status = 'failed';
          break;
        }
      }
      
      // Track warnings
      if (stepResult.duration > config.thresholds.stepDuration) {
        result.warnings.push(`Step '${stepResult.name}' took ${stepResult.duration}ms (threshold: ${config.thresholds.stepDuration}ms)`);
      }
    }
    
    // Calculate metrics
    const totalSteps = result.steps.length;
    const failedSteps = result.steps.filter(s => s.status === 'failed').length;
    const passedSteps = result.steps.filter(s => s.status === 'passed').length;
    const totalDuration = result.steps.reduce((sum, s) => sum + s.duration, 0);
    
    result.metrics.totalDuration = totalDuration;
    result.metrics.successRate = totalSteps > 0 ? (passedSteps / totalSteps) * 100 : 0;
    result.metrics.errorRate = totalSteps > 0 ? (failedSteps / totalSteps) * 100 : 0;
    result.metrics.avgResponseTime = totalSteps > 0 ? totalDuration / totalSteps : 0;
    
    // Find slowest step
    const slowestStep = result.steps.reduce((prev, current) => 
      prev.duration > current.duration ? prev : current
    );
    result.metrics.slowestStep = slowestStep.name;
    
    // Determine overall status
    if (result.metrics.errorRate > journey.thresholds.maxErrorRate) {
      result.status = 'failed';
      result.errors.push(`Error rate ${result.metrics.errorRate.toFixed(2)}% exceeds threshold ${journey.thresholds.maxErrorRate}%`);
    } else if (totalDuration > journey.thresholds.maxDuration) {
      result.status = 'warning';
      result.warnings.push(`Total duration ${totalDuration}ms exceeds threshold ${journey.thresholds.maxDuration}ms`);
    } else if (result.metrics.avgResponseTime > journey.thresholds.maxResponseTime) {
      result.status = 'warning';
      result.warnings.push(`Average response time ${result.metrics.avgResponseTime.toFixed(2)}ms exceeds threshold ${journey.thresholds.maxResponseTime}ms`);
    }
    
    // Generate recommendations
    if (result.metrics.errorRate > 0) {
      result.recommendations.push('Investigate failed steps and improve error handling');
    }
    if (result.metrics.avgResponseTime > 1000) {
      result.recommendations.push('Consider performance optimization for slow responses');
    }
    if (result.warnings.length > 0) {
      result.recommendations.push('Review performance thresholds and optimize slow components');
    }
    
    result.duration = Date.now() - startTime;
    
    // Store result
    if (!testResults.has(journey.id)) {
      testResults.set(journey.id, []);
    }
    const journeyResults = testResults.get(journey.id)!;
    journeyResults.push(result);
    
    // Keep only recent results
    if (journeyResults.length > 100) {
      journeyResults.splice(0, journeyResults.length - 100);
    }
    
    logger.info(`Synthetic journey completed: ${journey.name}`, {
      status: result.status,
      duration: result.duration,
      successRate: result.metrics.successRate,
      errorRate: result.metrics.errorRate,
    });
    
  } catch (error) {
    result.status = 'failed';
    result.duration = Date.now() - startTime;
    result.errors.push(`Journey execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    logger.error(`Synthetic journey failed: ${journey.name}`, error);
  }

  return result;
};

// Schedule synthetic journeys
export const scheduleJourney = (journey: SyntheticJourney) => {
  if (!config.enabled || !journey.enabled) return;
  
  // Clear existing schedule
  if (journeySchedules.has(journey.id)) {
    clearInterval(journeySchedules.get(journey.id)!);
  }
  
  // Schedule new interval
  const interval = setInterval(async () => {
    try {
      const result = await executeJourney(journey);
      
      // Send alerts if needed
      if (result.status === 'failed' && journey.alerting.onFailure) {
        await sendAlert(journey, result, 'failure');
      } else if (result.status === 'warning' && journey.alerting.onSlowResponse) {
        await sendAlert(journey, result, 'warning');
      }
    } catch (error) {
      logger.error(`Failed to execute scheduled journey: ${journey.name}`, error);
    }
  }, journey.schedule.interval);
  
  journeySchedules.set(journey.id, interval);
  
  logger.info(`Scheduled synthetic journey: ${journey.name}`, {
    interval: journey.schedule.interval,
    critical: journey.critical,
  });
};

// Send alert for synthetic test failure
const sendAlert = async (journey: SyntheticJourney, result: SyntheticTestResult, type: 'failure' | 'warning') => {
  if (!config.alerting.enabled) return;
  
  const alert = {
    type: 'synthetic_test_alert',
    severity: type === 'failure' ? 'critical' : 'warning',
    journey: journey.name,
    status: result.status,
    duration: result.duration,
    successRate: result.metrics.successRate,
    errorRate: result.metrics.errorRate,
    errors: result.errors,
    warnings: result.warnings,
    timestamp: result.timestamp,
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
      logger.error('Failed to send synthetic monitoring alert', error);
    }
  }
  
  logger.warn(`Synthetic monitoring alert sent: ${journey.name}`, alert);
};

// Get synthetic monitoring summary
export const getSyntheticMonitoringSummary = () => {
  const summary = {
    enabled: config.enabled,
    totalJourneys: defaultJourneys.length,
    activeJourneys: defaultJourneys.filter(j => j.enabled).length,
    criticalJourneys: defaultJourneys.filter(j => j.critical).length,
    scheduledJourneys: journeySchedules.size,
    recentResults: {} as Record<string, any>,
    overallHealth: {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      score: 100,
      message: 'All synthetic tests passing',
    },
    timestamp: new Date().toISOString(),
  };
  
  // Get recent results for each journey
  testResults.forEach((results, journeyId) => {
    if (results.length > 0) {
      const recentResult = results[results.length - 1];
      summary.recentResults[journeyId] = {
        status: recentResult.status,
        duration: recentResult.duration,
        successRate: recentResult.metrics.successRate,
        errorRate: recentResult.metrics.errorRate,
        timestamp: recentResult.timestamp,
      };
    }
  });
  
  // Calculate overall health
  const recentResults = Object.values(summary.recentResults);
  if (recentResults.length > 0) {
    const failedTests = recentResults.filter((r: any) => r.status === 'failed').length;
    const warningTests = recentResults.filter((r: any) => r.status === 'warning').length;
    
    summary.overallHealth.score = Math.round(((recentResults.length - failedTests) / recentResults.length) * 100);
    
    if (failedTests > 0) {
      summary.overallHealth.status = 'unhealthy';
      summary.overallHealth.message = `${failedTests} synthetic test(s) failing`;
    } else if (warningTests > 0) {
      summary.overallHealth.status = 'degraded';
      summary.overallHealth.message = `${warningTests} synthetic test(s) with warnings`;
    }
  }
  
  return summary;
};

// Start synthetic monitoring
export const startSyntheticMonitoring = () => {
  if (!config.enabled) {
    logger.info('Synthetic monitoring is disabled');
    return;
  }
  
  logger.info('Starting synthetic monitoring', {
    journeys: defaultJourneys.length,
    enabled: defaultJourneys.filter(j => j.enabled).length,
  });
  
  // Schedule all enabled journeys
  defaultJourneys.forEach(journey => {
    if (journey.enabled) {
      scheduleJourney(journey);
    }
  });
};

// Stop synthetic monitoring
export const stopSyntheticMonitoring = () => {
  journeySchedules.forEach((interval, journeyId) => {
    clearInterval(interval);
    logger.info(`Stopped synthetic journey: ${journeyId}`);
  });
  
  journeySchedules.clear();
  logger.info('Synthetic monitoring stopped');
};

// Export the synthetic monitoring service
export const syntheticMonitoring = {
  config,
  defaultJourneys,
  executeJourney,
  scheduleJourney,
  startMonitoring: startSyntheticMonitoring,
  stopMonitoring: stopSyntheticMonitoring,
  getSummary: getSyntheticMonitoringSummary,
  getResults: (journeyId: string) => testResults.get(journeyId) || [],
  getAllResults: () => Object.fromEntries(testResults),
};

export default syntheticMonitoring;