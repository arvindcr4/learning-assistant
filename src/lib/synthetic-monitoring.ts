/**
 * Synthetic monitoring for critical user journeys
 * Simulates real user interactions to detect issues before users experience them
 */
import { createLogger } from './logger';
import { alertManager } from './alerts';
import { metricsUtils } from './metrics';
import { env } from './env-validation';

const logger = createLogger('synthetic-monitoring');

// User journey definitions
interface UserJourney {
  id: string;
  name: string;
  description: string;
  steps: JourneyStep[];
  timeout: number;
  expectedDuration: number;
  criticalPath: boolean;
  schedule: string; // cron expression
  enabled: boolean;
}

interface JourneyStep {
  id: string;
  name: string;
  type: 'http' | 'api' | 'browser' | 'wait';
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  expectedStatus?: number;
  expectedResponseTime?: number;
  assertions?: Assertion[];
  waitTime?: number;
}

interface Assertion {
  type: 'contains' | 'equals' | 'not_contains' | 'status_code' | 'response_time' | 'json_path';
  field?: string;
  value: any;
  operator?: '==' | '!=' | '>' | '<' | '>=' | '<=';
}

interface JourneyResult {
  journeyId: string;
  timestamp: string;
  duration: number;
  success: boolean;
  steps: StepResult[];
  error?: string;
  metadata?: Record<string, any>;
}

interface StepResult {
  stepId: string;
  name: string;
  duration: number;
  success: boolean;
  responseTime?: number;
  statusCode?: number;
  error?: string;
  assertions?: AssertionResult[];
}

interface AssertionResult {
  type: string;
  field?: string;
  expected: any;
  actual: any;
  passed: boolean;
  error?: string;
}

// Configuration
const config = {
  enabled: process.env.ENABLE_SYNTHETIC_MONITORING === 'true',
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  timeout: parseInt(process.env.SYNTHETIC_TIMEOUT || '30000'),
  retries: parseInt(process.env.SYNTHETIC_RETRIES || '3'),
  concurrency: parseInt(process.env.SYNTHETIC_CONCURRENCY || '1'),
  userAgent: 'Learning-Assistant-Synthetic-Monitor/1.0',
};

// Define critical user journeys
const userJourneys: UserJourney[] = [
  {
    id: 'user-registration',
    name: 'User Registration Flow',
    description: 'Complete user registration and onboarding process',
    criticalPath: true,
    timeout: 60000,
    expectedDuration: 10000,
    schedule: '*/5 * * * *', // Every 5 minutes
    enabled: true,
    steps: [
      {
        id: 'homepage',
        name: 'Load Homepage',
        type: 'http',
        url: '/',
        method: 'GET',
        expectedStatus: 200,
        expectedResponseTime: 2000,
        assertions: [
          { type: 'contains', value: 'Learning Assistant' },
          { type: 'status_code', value: 200 },
        ],
      },
      {
        id: 'registration-page',
        name: 'Load Registration Page',
        type: 'http',
        url: '/auth/register',
        method: 'GET',
        expectedStatus: 200,
        expectedResponseTime: 2000,
        assertions: [
          { type: 'contains', value: 'Sign Up' },
          { type: 'status_code', value: 200 },
        ],
      },
      {
        id: 'register-user',
        name: 'Submit Registration',
        type: 'api',
        url: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          email: `test-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          name: 'Test User',
        },
        expectedStatus: 201,
        expectedResponseTime: 3000,
        assertions: [
          { type: 'status_code', value: 201 },
          { type: 'json_path', field: 'success', value: true },
        ],
      },
    ],
  },
  {
    id: 'learning-session',
    name: 'Learning Session Journey',
    description: 'Start and complete a learning session',
    criticalPath: true,
    timeout: 120000,
    expectedDuration: 30000,
    schedule: '*/10 * * * *', // Every 10 minutes
    enabled: true,
    steps: [
      {
        id: 'login',
        name: 'User Login',
        type: 'api',
        url: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          email: 'test@example.com',
          password: 'TestPassword123!',
        },
        expectedStatus: 200,
        expectedResponseTime: 2000,
        assertions: [
          { type: 'status_code', value: 200 },
          { type: 'json_path', field: 'token', value: true },
        ],
      },
      {
        id: 'dashboard',
        name: 'Load Dashboard',
        type: 'http',
        url: '/dashboard',
        method: 'GET',
        expectedStatus: 200,
        expectedResponseTime: 3000,
        assertions: [
          { type: 'contains', value: 'Dashboard' },
          { type: 'status_code', value: 200 },
        ],
      },
      {
        id: 'start-session',
        name: 'Start Learning Session',
        type: 'api',
        url: '/api/learning/session',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          contentType: 'quiz',
          learningStyle: 'visual',
        },
        expectedStatus: 201,
        expectedResponseTime: 2000,
        assertions: [
          { type: 'status_code', value: 201 },
          { type: 'json_path', field: 'sessionId', value: true },
        ],
      },
      {
        id: 'complete-session',
        name: 'Complete Learning Session',
        type: 'api',
        url: '/api/learning/session/{sessionId}/complete',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          score: 85,
          timeSpent: 300,
        },
        expectedStatus: 200,
        expectedResponseTime: 2000,
        assertions: [
          { type: 'status_code', value: 200 },
          { type: 'json_path', field: 'success', value: true },
        ],
      },
    ],
  },
  {
    id: 'api-health-check',
    name: 'API Health Check',
    description: 'Verify all critical API endpoints are responding',
    criticalPath: true,
    timeout: 30000,
    expectedDuration: 5000,
    schedule: '*/2 * * * *', // Every 2 minutes
    enabled: true,
    steps: [
      {
        id: 'health-endpoint',
        name: 'Health Endpoint',
        type: 'api',
        url: '/api/health',
        method: 'GET',
        expectedStatus: 200,
        expectedResponseTime: 1000,
        assertions: [
          { type: 'status_code', value: 200 },
          { type: 'json_path', field: 'status', value: 'healthy' },
        ],
      },
      {
        id: 'csrf-endpoint',
        name: 'CSRF Endpoint',
        type: 'api',
        url: '/api/csrf',
        method: 'GET',
        expectedStatus: 200,
        expectedResponseTime: 1000,
        assertions: [
          { type: 'status_code', value: 200 },
          { type: 'json_path', field: 'csrfToken', value: true },
        ],
      },
    ],
  },
  {
    id: 'content-delivery',
    name: 'Content Delivery Performance',
    description: 'Check content loading performance',
    criticalPath: false,
    timeout: 45000,
    expectedDuration: 15000,
    schedule: '*/15 * * * *', // Every 15 minutes
    enabled: true,
    steps: [
      {
        id: 'static-assets',
        name: 'Load Static Assets',
        type: 'http',
        url: '/_next/static/css/app.css',
        method: 'GET',
        expectedStatus: 200,
        expectedResponseTime: 2000,
        assertions: [
          { type: 'status_code', value: 200 },
        ],
      },
      {
        id: 'learning-content',
        name: 'Load Learning Content',
        type: 'api',
        url: '/api/learning/content',
        method: 'GET',
        expectedStatus: 200,
        expectedResponseTime: 3000,
        assertions: [
          { type: 'status_code', value: 200 },
          { type: 'json_path', field: 'content', value: true },
        ],
      },
    ],
  },
];

// Journey execution engine
class SyntheticMonitoringEngine {
  private journeyResults = new Map<string, JourneyResult[]>();
  private activeJourneys = new Set<string>();

  async executeJourney(journey: UserJourney): Promise<JourneyResult> {
    if (!config.enabled || this.activeJourneys.has(journey.id)) {
      throw new Error(`Journey ${journey.id} is already running or monitoring is disabled`);
    }

    this.activeJourneys.add(journey.id);
    const startTime = Date.now();

    logger.info('Starting synthetic journey', {
      journeyId: journey.id,
      name: journey.name,
      steps: journey.steps.length,
    });

    try {
      const stepResults: StepResult[] = [];
      let sessionData: Record<string, any> = {};

      for (const step of journey.steps) {
        const stepResult = await this.executeStep(step, sessionData);
        stepResults.push(stepResult);

        if (!stepResult.success) {
          throw new Error(`Step ${step.name} failed: ${stepResult.error}`);
        }

        // Extract data for subsequent steps
        if (stepResult.statusCode === 200 && step.type === 'api') {
          // Store session data (e.g., tokens, IDs) for next steps
          // This is a simplified example - in real implementation,
          // you'd parse response and extract needed data
        }
      }

      const duration = Date.now() - startTime;
      const result: JourneyResult = {
        journeyId: journey.id,
        timestamp: new Date().toISOString(),
        duration,
        success: true,
        steps: stepResults,
        metadata: {
          expectedDuration: journey.expectedDuration,
          criticalPath: journey.criticalPath,
        },
      };

      // Store result
      this.storeResult(journey.id, result);

      // Track metrics
      this.trackJourneyMetrics(journey, result);

      // Check for performance issues
      await this.checkPerformanceThresholds(journey, result);

      logger.info('Synthetic journey completed successfully', {
        journeyId: journey.id,
        duration,
        expectedDuration: journey.expectedDuration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: JourneyResult = {
        journeyId: journey.id,
        timestamp: new Date().toISOString(),
        duration,
        success: false,
        steps: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          expectedDuration: journey.expectedDuration,
          criticalPath: journey.criticalPath,
        },
      };

      // Store result
      this.storeResult(journey.id, result);

      // Send alert for failed critical path
      if (journey.criticalPath) {
        await alertManager.createAlert({
          title: 'Critical User Journey Failed',
          message: `Synthetic monitoring detected failure in ${journey.name}`,
          severity: 'critical',
          category: 'business',
          source: 'synthetic-monitoring',
          metadata: {
            journeyId: journey.id,
            journeyName: journey.name,
            error: result.error,
            duration,
          },
        });
      }

      logger.error('Synthetic journey failed', {
        journeyId: journey.id,
        error: result.error,
        duration,
      });

      throw error;
    } finally {
      this.activeJourneys.delete(journey.id);
    }
  }

  private async executeStep(step: JourneyStep, sessionData: Record<string, any>): Promise<StepResult> {
    const startTime = Date.now();

    try {
      let url = step.url;
      if (url && !url.startsWith('http')) {
        url = config.baseUrl + url;
      }

      // Replace variables in URL
      if (url && sessionData) {
        Object.keys(sessionData).forEach(key => {
          url = url!.replace(`{${key}}`, sessionData[key]);
        });
      }

      let response: Response | null = null;
      let responseData: any = null;

      switch (step.type) {
        case 'http':
        case 'api':
          if (!url) throw new Error('URL is required for HTTP/API steps');
          
          response = await fetch(url, {
            method: step.method || 'GET',
            headers: {
              'User-Agent': config.userAgent,
              ...step.headers,
            },
            body: step.body ? JSON.stringify(step.body) : undefined,
            signal: AbortSignal.timeout(config.timeout),
          });

          if (step.type === 'api') {
            try {
              responseData = await response.json();
            } catch {
              // Not JSON response
            }
          }
          break;

        case 'wait':
          await new Promise(resolve => setTimeout(resolve, step.waitTime || 1000));
          break;

        default:
          throw new Error(`Unsupported step type: ${step.type}`);
      }

      const duration = Date.now() - startTime;
      const statusCode = response?.status;

      // Run assertions
      const assertionResults = await this.runAssertions(step.assertions || [], {
        response,
        responseData,
        statusCode,
        duration,
      });

      const success = assertionResults.every(a => a.passed) && 
                     (step.expectedStatus ? statusCode === step.expectedStatus : true) &&
                     (step.expectedResponseTime ? duration <= step.expectedResponseTime : true);

      return {
        stepId: step.id,
        name: step.name,
        duration,
        success,
        responseTime: duration,
        statusCode,
        assertions: assertionResults,
        error: success ? undefined : 'Assertions failed or response time exceeded',
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        stepId: step.id,
        name: step.name,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async runAssertions(assertions: Assertion[], context: any): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];

    for (const assertion of assertions) {
      try {
        let actual: any;
        let passed = false;

        switch (assertion.type) {
          case 'status_code':
            actual = context.statusCode;
            passed = actual === assertion.value;
            break;

          case 'response_time':
            actual = context.duration;
            passed = assertion.operator ? 
              this.compareValues(actual, assertion.value, assertion.operator) :
              actual <= assertion.value;
            break;

          case 'contains':
            if (context.responseData && typeof context.responseData === 'string') {
              actual = context.responseData;
              passed = actual.includes(assertion.value);
            } else {
              actual = 'Non-string response';
              passed = false;
            }
            break;

          case 'json_path':
            if (context.responseData && assertion.field) {
              actual = this.getJsonPath(context.responseData, assertion.field);
              passed = assertion.value === true ? actual !== undefined : actual === assertion.value;
            } else {
              actual = undefined;
              passed = false;
            }
            break;

          case 'equals':
            actual = assertion.field ? this.getJsonPath(context.responseData, assertion.field) : context.responseData;
            passed = actual === assertion.value;
            break;

          case 'not_contains':
            if (context.responseData && typeof context.responseData === 'string') {
              actual = context.responseData;
              passed = !actual.includes(assertion.value);
            } else {
              actual = 'Non-string response';
              passed = false;
            }
            break;

          default:
            throw new Error(`Unsupported assertion type: ${assertion.type}`);
        }

        results.push({
          type: assertion.type,
          field: assertion.field,
          expected: assertion.value,
          actual,
          passed,
        });
      } catch (error) {
        results.push({
          type: assertion.type,
          field: assertion.field,
          expected: assertion.value,
          actual: undefined,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  private compareValues(actual: any, expected: any, operator: string): boolean {
    switch (operator) {
      case '==': return actual === expected;
      case '!=': return actual !== expected;
      case '>': return actual > expected;
      case '<': return actual < expected;
      case '>=': return actual >= expected;
      case '<=': return actual <= expected;
      default: return false;
    }
  }

  private getJsonPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  private storeResult(journeyId: string, result: JourneyResult) {
    if (!this.journeyResults.has(journeyId)) {
      this.journeyResults.set(journeyId, []);
    }

    const results = this.journeyResults.get(journeyId)!;
    results.push(result);

    // Keep only last 100 results per journey
    if (results.length > 100) {
      results.splice(0, results.length - 100);
    }
  }

  private trackJourneyMetrics(journey: UserJourney, result: JourneyResult) {
    // Track success/failure
    metricsUtils.recordCounter('synthetic_journey_total', 1, {
      journey_id: journey.id,
      journey_name: journey.name,
      status: result.success ? 'success' : 'failure',
      critical_path: journey.criticalPath.toString(),
    });

    // Track duration
    metricsUtils.recordHistogram('synthetic_journey_duration_seconds', result.duration / 1000, {
      journey_id: journey.id,
      journey_name: journey.name,
    });

    // Track step metrics
    result.steps.forEach(step => {
      metricsUtils.recordCounter('synthetic_step_total', 1, {
        journey_id: journey.id,
        step_id: step.stepId,
        step_name: step.name,
        status: step.success ? 'success' : 'failure',
      });

      if (step.responseTime) {
        metricsUtils.recordHistogram('synthetic_step_duration_seconds', step.responseTime / 1000, {
          journey_id: journey.id,
          step_id: step.stepId,
          step_name: step.name,
        });
      }
    });
  }

  private async checkPerformanceThresholds(journey: UserJourney, result: JourneyResult) {
    // Check overall duration
    if (result.duration > journey.expectedDuration * 1.5) {
      await alertManager.createAlert({
        title: 'Synthetic Journey Performance Degradation',
        message: `Journey ${journey.name} took ${result.duration}ms (expected: ${journey.expectedDuration}ms)`,
        severity: 'warning',
        category: 'performance',
        source: 'synthetic-monitoring',
        metadata: {
          journeyId: journey.id,
          journeyName: journey.name,
          actualDuration: result.duration,
          expectedDuration: journey.expectedDuration,
        },
      });
    }

    // Check individual step performance
    for (const step of result.steps) {
      if (step.responseTime && step.responseTime > 5000) { // 5 seconds
        await alertManager.createAlert({
          title: 'Synthetic Step Performance Issue',
          message: `Step ${step.name} in journey ${journey.name} took ${step.responseTime}ms`,
          severity: 'warning',
          category: 'performance',
          source: 'synthetic-monitoring',
          metadata: {
            journeyId: journey.id,
            stepId: step.stepId,
            stepName: step.name,
            responseTime: step.responseTime,
          },
        });
      }
    }
  }

  getJourneyResults(journeyId: string): JourneyResult[] {
    return this.journeyResults.get(journeyId) || [];
  }

  getAllResults(): Map<string, JourneyResult[]> {
    return new Map(this.journeyResults);
  }

  getJourneyStats(journeyId: string) {
    const results = this.getJourneyResults(journeyId);
    if (results.length === 0) return null;

    const successfulRuns = results.filter(r => r.success);
    const failedRuns = results.filter(r => !r.success);
    const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const successRate = (successfulRuns.length / results.length) * 100;

    return {
      totalRuns: results.length,
      successfulRuns: successfulRuns.length,
      failedRuns: failedRuns.length,
      successRate,
      averageDuration,
      lastRun: results[results.length - 1],
    };
  }
}

// Initialize monitoring engine
const monitoringEngine = new SyntheticMonitoringEngine();

// Synthetic monitoring service
export const syntheticMonitoring = {
  // Execute a specific journey
  executeJourney: async (journeyId: string) => {
    const journey = userJourneys.find(j => j.id === journeyId);
    if (!journey) {
      throw new Error(`Journey ${journeyId} not found`);
    }

    return monitoringEngine.executeJourney(journey);
  },

  // Execute all enabled journeys
  executeAllJourneys: async () => {
    const enabledJourneys = userJourneys.filter(j => j.enabled);
    const results = [];

    for (const journey of enabledJourneys) {
      try {
        const result = await monitoringEngine.executeJourney(journey);
        results.push(result);
      } catch (error) {
        logger.error('Journey execution failed', {
          journeyId: journey.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  },

  // Get journey results
  getJourneyResults: (journeyId: string) => monitoringEngine.getJourneyResults(journeyId),

  // Get all results
  getAllResults: () => monitoringEngine.getAllResults(),

  // Get journey statistics
  getJourneyStats: (journeyId: string) => monitoringEngine.getJourneyStats(journeyId),

  // Get available journeys
  getJourneys: () => userJourneys,

  // Start scheduled monitoring
  startScheduledMonitoring: () => {
    if (!config.enabled) {
      logger.info('Synthetic monitoring is disabled');
      return;
    }

    // For this example, we'll run journeys at fixed intervals
    // In production, you'd use a proper cron scheduler
    setInterval(async () => {
      for (const journey of userJourneys) {
        if (!journey.enabled) continue;

        try {
          await monitoringEngine.executeJourney(journey);
        } catch (error) {
          logger.error('Scheduled journey failed', {
            journeyId: journey.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }, 300000); // Run every 5 minutes

    logger.info('Synthetic monitoring started', {
      journeys: userJourneys.filter(j => j.enabled).length,
      config,
    });
  },

  // Configuration
  getConfig: () => config,
  updateConfig: (updates: Partial<typeof config>) => {
    Object.assign(config, updates);
    logger.info('Synthetic monitoring configuration updated', updates);
  },
};

// Auto-start if enabled
if (config.enabled) {
  syntheticMonitoring.startScheduledMonitoring();
}

export default syntheticMonitoring;