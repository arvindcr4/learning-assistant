/**
 * Circuit breaker patterns for resilience
 * Prevents cascade failures by failing fast when dependencies are unhealthy
 */
import { createLogger } from '../logger';
import { env } from '../env-validation';

const logger = createLogger('circuit-breaker');

// Circuit breaker states
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;      // Number of failures before opening
  successThreshold: number;      // Number of successes to close from half-open
  timeout: number;               // Timeout for requests
  resetTimeout: number;          // Time to wait before trying half-open
  monitoringWindow: number;      // Time window for failure tracking
  volumeThreshold: number;       // Minimum requests before considering failure rate
  fallbackEnabled: boolean;      // Whether to use fallback responses
  fallbackResponse?: any;        // Default fallback response
  alerting: {
    enabled: boolean;
    onOpen: boolean;
    onHalfOpen: boolean;
    onClose: boolean;
  };
}

// Circuit breaker metrics
export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  openedAt?: number;
  halfOpenedAt?: number;
  closedAt?: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  averageResponseTime: number;
  lastResetTime: number;
}

// Circuit breaker result
export interface CircuitBreakerResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  fallback?: boolean;
  circuitState: CircuitBreakerState;
  responseTime: number;
  timestamp: number;
}

// Default circuit breaker configuration
const defaultConfig: Partial<CircuitBreakerConfig> = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 10000,
  resetTimeout: 60000,
  monitoringWindow: 120000,
  volumeThreshold: 10,
  fallbackEnabled: true,
  alerting: {
    enabled: true,
    onOpen: true,
    onHalfOpen: false,
    onClose: true,
  },
};

// Circuit breaker class
export class CircuitBreaker<T = any> {
  private config: CircuitBreakerConfig;
  private metrics: CircuitBreakerMetrics;
  private requests: Array<{ timestamp: number; success: boolean; responseTime: number }> = [];
  private resetTimer?: NodeJS.Timeout;

  constructor(config: CircuitBreakerConfig) {
    this.config = { ...defaultConfig, ...config } as CircuitBreakerConfig;
    this.metrics = {
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      successCount: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      averageResponseTime: 0,
      lastResetTime: Date.now(),
    };
  }

  // Execute a function with circuit breaker protection
  async execute<R = T>(
    fn: () => Promise<R>,
    fallback?: () => Promise<R> | R
  ): Promise<CircuitBreakerResult<R>> {
    const startTime = Date.now();
    
    // Check if circuit is open
    if (this.metrics.state === CircuitBreakerState.OPEN) {
      this.metrics.rejectedRequests++;
      
      // Check if we should try half-open
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        return this.handleRejection(startTime, fallback);
      }
    }

    // Execute the function
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), this.config.timeout);
      });

      const result = await Promise.race([fn(), timeoutPromise]);
      
      return this.handleSuccess(result, startTime);
    } catch (error) {
      return this.handleFailure(error as Error, startTime, fallback);
    }
  }

  // Handle successful request
  private handleSuccess<R>(result: R, startTime: number): CircuitBreakerResult<R> {
    const responseTime = Date.now() - startTime;
    
    this.recordRequest(true, responseTime);
    this.metrics.successCount++;
    this.metrics.successfulRequests++;
    this.metrics.lastSuccessTime = Date.now();
    
    // Reset failure count on success
    if (this.metrics.state === CircuitBreakerState.HALF_OPEN) {
      if (this.metrics.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    } else if (this.metrics.state === CircuitBreakerState.CLOSED) {
      this.metrics.failureCount = 0;
    }

    return {
      success: true,
      data: result,
      fallback: false,
      circuitState: this.metrics.state,
      responseTime,
      timestamp: Date.now(),
    };
  }

  // Handle failed request
  private async handleFailure<R>(
    error: Error,
    startTime: number,
    fallback?: () => Promise<R> | R
  ): Promise<CircuitBreakerResult<R>> {
    const responseTime = Date.now() - startTime;
    
    this.recordRequest(false, responseTime);
    this.metrics.failureCount++;
    this.metrics.failedRequests++;
    this.metrics.lastFailureTime = Date.now();
    
    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.transitionToOpen();
    }

    // Try fallback if available
    if (fallback && this.config.fallbackEnabled) {
      try {
        const fallbackResult = await fallback();
        return {
          success: true,
          data: fallbackResult,
          fallback: true,
          circuitState: this.metrics.state,
          responseTime,
          timestamp: Date.now(),
        };
      } catch (fallbackError) {
        logger.error(`Fallback failed for circuit breaker: ${this.config.name}`, fallbackError);
      }
    }

    // Return default fallback if configured
    if (this.config.fallbackResponse !== undefined) {
      return {
        success: true,
        data: this.config.fallbackResponse,
        fallback: true,
        circuitState: this.metrics.state,
        responseTime,
        timestamp: Date.now(),
      };
    }

    return {
      success: false,
      error,
      fallback: false,
      circuitState: this.metrics.state,
      responseTime,
      timestamp: Date.now(),
    };
  }

  // Handle rejected request (circuit is open)
  private async handleRejection<R>(
    startTime: number,
    fallback?: () => Promise<R> | R
  ): Promise<CircuitBreakerResult<R>> {
    const responseTime = Date.now() - startTime;
    
    // Try fallback if available
    if (fallback && this.config.fallbackEnabled) {
      try {
        const fallbackResult = await fallback();
        return {
          success: true,
          data: fallbackResult,
          fallback: true,
          circuitState: this.metrics.state,
          responseTime,
          timestamp: Date.now(),
        };
      } catch (fallbackError) {
        logger.error(`Fallback failed for circuit breaker: ${this.config.name}`, fallbackError);
      }
    }

    // Return default fallback if configured
    if (this.config.fallbackResponse !== undefined) {
      return {
        success: true,
        data: this.config.fallbackResponse,
        fallback: true,
        circuitState: this.metrics.state,
        responseTime,
        timestamp: Date.now(),
      };
    }

    return {
      success: false,
      error: new Error('Circuit breaker is open'),
      fallback: false,
      circuitState: this.metrics.state,
      responseTime,
      timestamp: Date.now(),
    };
  }

  // Record request for metrics
  private recordRequest(success: boolean, responseTime: number) {
    const now = Date.now();
    
    this.requests.push({
      timestamp: now,
      success,
      responseTime,
    });

    // Clean old requests outside monitoring window
    this.requests = this.requests.filter(
      req => now - req.timestamp <= this.config.monitoringWindow
    );

    // Update metrics
    this.metrics.totalRequests++;
    this.updateAverageResponseTime(responseTime);
  }

  // Update average response time
  private updateAverageResponseTime(responseTime: number) {
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1);
    this.metrics.averageResponseTime = (totalTime + responseTime) / this.metrics.totalRequests;
  }

  // Check if circuit should be opened
  private shouldOpenCircuit(): boolean {
    if (this.metrics.state === CircuitBreakerState.OPEN) {
      return false;
    }

    // Need minimum volume of requests
    if (this.requests.length < this.config.volumeThreshold) {
      return false;
    }

    // Check failure rate
    const failures = this.requests.filter(req => !req.success).length;
    const failureRate = failures / this.requests.length;
    
    return this.metrics.failureCount >= this.config.failureThreshold || 
           failureRate >= 0.5; // 50% failure rate threshold
  }

  // Check if we should attempt reset (half-open)
  private shouldAttemptReset(): boolean {
    if (this.metrics.state !== CircuitBreakerState.OPEN) {
      return false;
    }

    return this.metrics.openedAt && 
           (Date.now() - this.metrics.openedAt) >= this.config.resetTimeout;
  }

  // Transition to OPEN state
  private transitionToOpen() {
    if (this.metrics.state === CircuitBreakerState.OPEN) {
      return;
    }

    this.metrics.state = CircuitBreakerState.OPEN;
    this.metrics.openedAt = Date.now();
    
    // Schedule reset attempt
    this.resetTimer = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.config.resetTimeout);

    logger.warn(`Circuit breaker opened: ${this.config.name}`, {
      failureCount: this.metrics.failureCount,
      successCount: this.metrics.successCount,
    });

    // Send alert
    if (this.config.alerting.enabled && this.config.alerting.onOpen) {
      this.sendAlert('open');
    }
  }

  // Transition to HALF_OPEN state
  private transitionToHalfOpen() {
    this.metrics.state = CircuitBreakerState.HALF_OPEN;
    this.metrics.halfOpenedAt = Date.now();
    this.metrics.successCount = 0;
    this.metrics.failureCount = 0;

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    logger.info(`Circuit breaker half-opened: ${this.config.name}`);

    // Send alert
    if (this.config.alerting.enabled && this.config.alerting.onHalfOpen) {
      this.sendAlert('half-open');
    }
  }

  // Transition to CLOSED state
  private transitionToClosed() {
    this.metrics.state = CircuitBreakerState.CLOSED;
    this.metrics.closedAt = Date.now();
    this.metrics.failureCount = 0;
    this.metrics.successCount = 0;

    logger.info(`Circuit breaker closed: ${this.config.name}`);

    // Send alert
    if (this.config.alerting.enabled && this.config.alerting.onClose) {
      this.sendAlert('close');
    }
  }

  // Send alert
  private async sendAlert(event: 'open' | 'half-open' | 'close') {
    const alert = {
      type: 'circuit_breaker_alert',
      event,
      circuitBreaker: this.config.name,
      state: this.metrics.state,
      metrics: this.metrics,
      timestamp: new Date().toISOString(),
    };

    logger.warn(`Circuit breaker alert: ${this.config.name}`, alert);
    
    // Here you would integrate with your alerting system
    // e.g., send to Slack, email, webhook, etc.
  }

  // Get current metrics
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  // Get current state
  getState(): CircuitBreakerState {
    return this.metrics.state;
  }

  // Get configuration
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  // Reset circuit breaker
  reset() {
    this.metrics.state = CircuitBreakerState.CLOSED;
    this.metrics.failureCount = 0;
    this.metrics.successCount = 0;
    this.metrics.lastResetTime = Date.now();
    this.requests = [];

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    logger.info(`Circuit breaker reset: ${this.config.name}`);
  }

  // Force open circuit
  forceOpen() {
    this.transitionToOpen();
  }

  // Force close circuit
  forceClose() {
    this.transitionToClosed();
  }
}

// Circuit breaker manager
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();
  private configs = new Map<string, CircuitBreakerConfig>();

  // Create or get circuit breaker
  getOrCreate(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const fullConfig: CircuitBreakerConfig = {
        ...defaultConfig,
        ...config,
        name,
      } as CircuitBreakerConfig;

      this.configs.set(name, fullConfig);
      this.breakers.set(name, new CircuitBreaker(fullConfig));
    }

    return this.breakers.get(name)!;
  }

  // Get circuit breaker
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  // Get all circuit breakers
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  // Get metrics for all circuit breakers
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    
    this.breakers.forEach((breaker, name) => {
      metrics[name] = breaker.getMetrics();
    });

    return metrics;
  }

  // Get summary of all circuit breakers
  getSummary() {
    const allMetrics = this.getAllMetrics();
    const breakerNames = Object.keys(allMetrics);
    
    return {
      totalBreakers: breakerNames.length,
      openBreakers: breakerNames.filter(name => allMetrics[name].state === CircuitBreakerState.OPEN).length,
      halfOpenBreakers: breakerNames.filter(name => allMetrics[name].state === CircuitBreakerState.HALF_OPEN).length,
      closedBreakers: breakerNames.filter(name => allMetrics[name].state === CircuitBreakerState.CLOSED).length,
      totalRequests: Object.values(allMetrics).reduce((sum, m) => sum + m.totalRequests, 0),
      totalFailures: Object.values(allMetrics).reduce((sum, m) => sum + m.failedRequests, 0),
      totalRejections: Object.values(allMetrics).reduce((sum, m) => sum + m.rejectedRequests, 0),
      averageResponseTime: Object.values(allMetrics).reduce((sum, m) => sum + m.averageResponseTime, 0) / breakerNames.length,
      breakers: allMetrics,
      timestamp: new Date().toISOString(),
    };
  }

  // Reset all circuit breakers
  resetAll() {
    this.breakers.forEach(breaker => breaker.reset());
    logger.info('All circuit breakers reset');
  }

  // Remove circuit breaker
  remove(name: string) {
    this.breakers.delete(name);
    this.configs.delete(name);
    logger.info(`Circuit breaker removed: ${name}`);
  }

  // Clear all circuit breakers
  clear() {
    this.breakers.clear();
    this.configs.clear();
    logger.info('All circuit breakers cleared');
  }
}

// Global circuit breaker manager instance
export const circuitBreakerManager = new CircuitBreakerManager();

// Predefined circuit breakers for common dependencies
export const createDependencyCircuitBreakers = () => {
  // Database circuit breaker
  circuitBreakerManager.getOrCreate('database', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 5000,
    resetTimeout: 30000,
    fallbackEnabled: true,
    fallbackResponse: null,
  });

  // Redis circuit breaker
  circuitBreakerManager.getOrCreate('redis', {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 3000,
    resetTimeout: 60000,
    fallbackEnabled: true,
    fallbackResponse: null,
  });

  // External API circuit breaker
  circuitBreakerManager.getOrCreate('external-api', {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 15000,
    resetTimeout: 120000,
    fallbackEnabled: true,
    fallbackResponse: { error: 'Service temporarily unavailable' },
  });

  // Email service circuit breaker
  circuitBreakerManager.getOrCreate('email-service', {
    failureThreshold: 10,
    successThreshold: 5,
    timeout: 10000,
    resetTimeout: 300000, // 5 minutes
    fallbackEnabled: true,
    fallbackResponse: { queued: true },
  });

  logger.info('Dependency circuit breakers created');
};

// Utility functions for common patterns
export const withCircuitBreaker = <T>(
  name: string,
  fn: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>,
  fallback?: () => Promise<T> | T
): Promise<CircuitBreakerResult<T>> => {
  const breaker = circuitBreakerManager.getOrCreate(name, config);
  return breaker.execute(fn, fallback);
};

export const withDatabaseCircuitBreaker = <T>(
  fn: () => Promise<T>,
  fallback?: () => Promise<T> | T
): Promise<CircuitBreakerResult<T>> => {
  return withCircuitBreaker('database', fn, undefined, fallback);
};

export const withRedisCircuitBreaker = <T>(
  fn: () => Promise<T>,
  fallback?: () => Promise<T> | T
): Promise<CircuitBreakerResult<T>> => {
  return withCircuitBreaker('redis', fn, undefined, fallback);
};

export const withExternalAPICircuitBreaker = <T>(
  fn: () => Promise<T>,
  fallback?: () => Promise<T> | T
): Promise<CircuitBreakerResult<T>> => {
  return withCircuitBreaker('external-api', fn, undefined, fallback);
};

// Initialize circuit breakers
createDependencyCircuitBreakers();

logger.info('Circuit breaker system initialized');

export default {
  CircuitBreaker,
  CircuitBreakerManager,
  circuitBreakerManager,
  CircuitBreakerState,
  withCircuitBreaker,
  withDatabaseCircuitBreaker,
  withRedisCircuitBreaker,
  withExternalAPICircuitBreaker,
  createDependencyCircuitBreakers,
};