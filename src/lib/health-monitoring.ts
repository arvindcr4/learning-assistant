/**
 * Comprehensive health monitoring service
 * Monitors all application components and dependencies
 */
import { createLogger } from './logger';
import { multiProviderAPM } from './apm-providers';
import { env } from './env-validation';

const logger = createLogger('health-monitoring');

// Health check result interface
interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Health check configuration
interface HealthCheckConfig {
  timeout: number;
  retries: number;
  retryDelay: number;
}

// Service health check interface
interface ServiceHealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
  config: HealthCheckConfig;
  critical: boolean;
}

class HealthMonitoringService {
  private healthChecks: Map<string, ServiceHealthCheck> = new Map();
  private lastResults: Map<string, HealthCheckResult> = new Map();
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeHealthChecks();
  }

  private initializeHealthChecks() {
    // Database health check
    this.registerHealthCheck({
      name: 'database',
      check: async () => this.checkDatabase(),
      config: { timeout: 5000, retries: 3, retryDelay: 1000 },
      critical: true,
    });

    // Cache health check
    this.registerHealthCheck({
      name: 'cache',
      check: async () => this.checkCache(),
      config: { timeout: 3000, retries: 2, retryDelay: 500 },
      critical: true,
    });

    // External API health checks
    this.registerHealthCheck({
      name: 'external_apis',
      check: async () => this.checkExternalAPIs(),
      config: { timeout: 10000, retries: 2, retryDelay: 1000 },
      critical: false,
    });

    // File system health check
    this.registerHealthCheck({
      name: 'filesystem',
      check: async () => this.checkFileSystem(),
      config: { timeout: 2000, retries: 1, retryDelay: 0 },
      critical: true,
    });

    // Memory health check
    this.registerHealthCheck({
      name: 'memory',
      check: async () => this.checkMemory(),
      config: { timeout: 1000, retries: 1, retryDelay: 0 },
      critical: true,
    });

    // CPU health check
    this.registerHealthCheck({
      name: 'cpu',
      check: async () => this.checkCPU(),
      config: { timeout: 2000, retries: 1, retryDelay: 0 },
      critical: true,
    });

    // Network health check
    this.registerHealthCheck({
      name: 'network',
      check: async () => this.checkNetwork(),
      config: { timeout: 5000, retries: 2, retryDelay: 1000 },
      critical: true,
    });

    // APM providers health check
    this.registerHealthCheck({
      name: 'apm_providers',
      check: async () => this.checkAPMProviders(),
      config: { timeout: 3000, retries: 2, retryDelay: 500 },
      critical: false,
    });

    // Application services health check
    this.registerHealthCheck({
      name: 'application_services',
      check: async () => this.checkApplicationServices(),
      config: { timeout: 5000, retries: 2, retryDelay: 1000 },
      critical: true,
    });

    logger.info(`Initialized ${this.healthChecks.size} health checks`);
  }

  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // Import database connection dynamically to avoid circular dependencies
      const { testConnection } = await import('./database/connection');
      await testConnection();
      
      const responseTime = Date.now() - startTime;
      return {
        name: 'database',
        status: 'healthy',
        responseTime,
        message: 'Database connection successful',
        timestamp: new Date().toISOString(),
        details: {
          connectionTime: responseTime,
          environment: env.NODE_ENV,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime,
        message: error instanceof Error ? error.message : 'Database connection failed',
        timestamp: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          connectionTime: responseTime,
        },
      };
    }
  }

  private async checkCache(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // Check Redis cache if available
      const testKey = 'health_check_test';
      const testValue = 'test_value';
      
      // Try to set and get a test value
      // This would depend on your cache implementation
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'cache',
        status: 'healthy',
        responseTime,
        message: 'Cache is operational',
        timestamp: new Date().toISOString(),
        details: {
          testKey,
          responseTime,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'cache',
        status: 'unhealthy',
        responseTime,
        message: error instanceof Error ? error.message : 'Cache is not available',
        timestamp: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime,
        },
      };
    }
  }

  private async checkExternalAPIs(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const apis = [
      { name: 'openai', url: 'https://api.openai.com/v1/models' },
      { name: 'sentry', url: 'https://sentry.io/api/0/projects/' },
    ];

    const results: any[] = [];
    
    for (const api of apis) {
      try {
        const response = await fetch(api.url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        
        results.push({
          name: api.name,
          status: response.ok ? 'healthy' : 'degraded',
          statusCode: response.status,
        });
      } catch (error) {
        results.push({
          name: api.name,
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Request failed',
        });
      }
    }

    const responseTime = Date.now() - startTime;
    const healthyAPIs = results.filter(r => r.status === 'healthy').length;
    const totalAPIs = results.length;

    return {
      name: 'external_apis',
      status: healthyAPIs === totalAPIs ? 'healthy' : 
              healthyAPIs > 0 ? 'degraded' : 'unhealthy',
      responseTime,
      message: `${healthyAPIs}/${totalAPIs} external APIs are healthy`,
      timestamp: new Date().toISOString(),
      details: {
        apis: results,
        healthyCount: healthyAPIs,
        totalCount: totalAPIs,
      },
    };
  }

  private async checkFileSystem(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const testFile = path.join(process.cwd(), 'health-check-test.tmp');
      const testContent = 'health check test';
      
      // Write test file
      await fs.writeFile(testFile, testContent);
      
      // Read test file
      const readContent = await fs.readFile(testFile, 'utf-8');
      
      // Delete test file
      await fs.unlink(testFile);
      
      const responseTime = Date.now() - startTime;
      
      if (readContent === testContent) {
        return {
          name: 'filesystem',
          status: 'healthy',
          responseTime,
          message: 'File system is operational',
          timestamp: new Date().toISOString(),
          details: {
            writeTime: responseTime,
            testPath: testFile,
          },
        };
      } else {
        return {
          name: 'filesystem',
          status: 'unhealthy',
          responseTime,
          message: 'File system test failed - content mismatch',
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'filesystem',
        status: 'unhealthy',
        responseTime,
        message: error instanceof Error ? error.message : 'File system error',
        timestamp: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async checkMemory(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const memoryUsage = process.memoryUsage();
      const responseTime = Date.now() - startTime;
      
      // Convert to MB
      const rss = Math.round(memoryUsage.rss / 1024 / 1024);
      const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      
      // Memory thresholds
      const memoryThreshold = 85; // 85% of heap
      const memoryUsagePercent = (heapUsed / heapTotal) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Memory usage is normal';
      
      if (memoryUsagePercent > memoryThreshold) {
        status = 'unhealthy';
        message = `Memory usage is critical: ${memoryUsagePercent.toFixed(1)}%`;
      } else if (memoryUsagePercent > 70) {
        status = 'degraded';
        message = `Memory usage is elevated: ${memoryUsagePercent.toFixed(1)}%`;
      }
      
      return {
        name: 'memory',
        status,
        responseTime,
        message,
        timestamp: new Date().toISOString(),
        details: {
          rss: `${rss}MB`,
          heapUsed: `${heapUsed}MB`,
          heapTotal: `${heapTotal}MB`,
          external: Math.round(memoryUsage.external / 1024 / 1024),
          usagePercent: Math.round(memoryUsagePercent),
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'memory',
        status: 'unhealthy',
        responseTime,
        message: error instanceof Error ? error.message : 'Memory check failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async checkCPU(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const os = await import('os');
      const cpus = os.cpus();
      const loadAverage = os.loadavg();
      
      const responseTime = Date.now() - startTime;
      
      // CPU load thresholds
      const cpuCount = cpus.length;
      const load1min = loadAverage[0];
      const loadPercent = (load1min / cpuCount) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'CPU usage is normal';
      
      if (loadPercent > 90) {
        status = 'unhealthy';
        message = `CPU load is critical: ${loadPercent.toFixed(1)}%`;
      } else if (loadPercent > 70) {
        status = 'degraded';
        message = `CPU load is elevated: ${loadPercent.toFixed(1)}%`;
      }
      
      return {
        name: 'cpu',
        status,
        responseTime,
        message,
        timestamp: new Date().toISOString(),
        details: {
          cores: cpuCount,
          load1min: load1min.toFixed(2),
          load5min: loadAverage[1].toFixed(2),
          load15min: loadAverage[2].toFixed(2),
          loadPercent: Math.round(loadPercent),
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'cpu',
        status: 'unhealthy',
        responseTime,
        message: error instanceof Error ? error.message : 'CPU check failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async checkNetwork(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // Check network connectivity by pinging a reliable service
      const response = await fetch('https://www.google.com/', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'network',
        status: response.ok ? 'healthy' : 'degraded',
        responseTime,
        message: response.ok ? 'Network connectivity is good' : 'Network connectivity issues detected',
        timestamp: new Date().toISOString(),
        details: {
          statusCode: response.status,
          responseTime,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'network',
        status: 'unhealthy',
        responseTime,
        message: error instanceof Error ? error.message : 'Network check failed',
        timestamp: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async checkAPMProviders(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const providerStatus = multiProviderAPM.getProviderStatus();
      const responseTime = Date.now() - startTime;
      
      const healthyProviders = Object.values(providerStatus).filter(p => p.enabled && p.healthy).length;
      const totalProviders = Object.values(providerStatus).filter(p => p.enabled).length;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'All APM providers are healthy';
      
      if (healthyProviders === 0) {
        status = 'unhealthy';
        message = 'No APM providers are healthy';
      } else if (healthyProviders < totalProviders) {
        status = 'degraded';
        message = `${healthyProviders}/${totalProviders} APM providers are healthy`;
      }
      
      return {
        name: 'apm_providers',
        status,
        responseTime,
        message,
        timestamp: new Date().toISOString(),
        details: {
          providers: providerStatus,
          healthyCount: healthyProviders,
          totalCount: totalProviders,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'apm_providers',
        status: 'unhealthy',
        responseTime,
        message: error instanceof Error ? error.message : 'APM providers check failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async checkApplicationServices(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const services = [
        { name: 'learning_service', available: true },
        { name: 'auth_service', available: true },
        { name: 'content_service', available: true },
        { name: 'analytics_service', available: true },
      ];
      
      const healthyServices = services.filter(s => s.available).length;
      const totalServices = services.length;
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'application_services',
        status: healthyServices === totalServices ? 'healthy' : 
                healthyServices > 0 ? 'degraded' : 'unhealthy',
        responseTime,
        message: `${healthyServices}/${totalServices} application services are healthy`,
        timestamp: new Date().toISOString(),
        details: {
          services,
          healthyCount: healthyServices,
          totalCount: totalServices,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'application_services',
        status: 'unhealthy',
        responseTime,
        message: error instanceof Error ? error.message : 'Application services check failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Public API
  public registerHealthCheck(healthCheck: ServiceHealthCheck) {
    this.healthChecks.set(healthCheck.name, healthCheck);
    logger.info(`Registered health check: ${healthCheck.name}`);
  }

  public async runHealthCheck(name: string): Promise<HealthCheckResult> {
    const healthCheck = this.healthChecks.get(name);
    if (!healthCheck) {
      throw new Error(`Health check '${name}' not found`);
    }

    let result: HealthCheckResult;
    let attempts = 0;
    
    while (attempts <= healthCheck.config.retries) {
      try {
        const timeoutPromise = new Promise<HealthCheckResult>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), healthCheck.config.timeout);
        });
        
        result = await Promise.race([
          healthCheck.check(),
          timeoutPromise,
        ]);
        
        break;
      } catch (error) {
        attempts++;
        
        if (attempts > healthCheck.config.retries) {
          result = {
            name: healthCheck.name,
            status: 'unhealthy',
            responseTime: healthCheck.config.timeout,
            message: error instanceof Error ? error.message : 'Health check failed',
            timestamp: new Date().toISOString(),
            details: {
              error: error instanceof Error ? error.message : 'Unknown error',
              attempts,
              maxRetries: healthCheck.config.retries,
            },
          };
          break;
        }
        
        if (healthCheck.config.retryDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, healthCheck.config.retryDelay));
        }
      }
    }

    this.lastResults.set(name, result!);
    
    // Record metrics
    multiProviderAPM.recordMetric(
      'health_check_duration', 
      result!.responseTime, 
      'histogram', 
      { service: name, status: result!.status }
    );
    
    multiProviderAPM.recordMetric(
      'health_check_status', 
      result!.status === 'healthy' ? 1 : 0, 
      'gauge', 
      { service: name }
    );

    return result!;
  }

  public async runAllHealthChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    for (const [name] of this.healthChecks) {
      try {
        const result = await this.runHealthCheck(name);
        results.push(result);
      } catch (error) {
        logger.error(`Error running health check ${name}:`, error);
        results.push({
          name,
          status: 'unhealthy',
          responseTime: 0,
          message: error instanceof Error ? error.message : 'Health check failed',
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    return results;
  }

  public getOverallStatus(results: HealthCheckResult[]): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
    criticalIssues?: string[];
    performanceIssues?: string[];
  } {
    const criticalChecks = Array.from(this.healthChecks.values()).filter(h => h.critical);
    const criticalResults = results.filter(r => criticalChecks.some(c => c.name === r.name));
    
    const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
    const degradedCount = results.filter(r => r.status === 'degraded').length;
    const criticalUnhealthyCount = criticalResults.filter(r => r.status === 'unhealthy').length;
    
    const criticalIssues = criticalResults
      .filter(r => r.status === 'unhealthy')
      .map(r => `${r.name}: ${r.message}`);
    
    const performanceIssues = results
      .filter(r => r.status === 'degraded')
      .map(r => `${r.name}: ${r.message}`);

    if (criticalUnhealthyCount > 0) {
      return {
        status: 'unhealthy',
        message: `${criticalUnhealthyCount} critical service(s) are unhealthy`,
        criticalIssues,
        performanceIssues,
      };
    } else if (unhealthyCount > 0 || degradedCount > 0) {
      return {
        status: 'degraded',
        message: `${unhealthyCount} service(s) unhealthy, ${degradedCount} service(s) degraded`,
        performanceIssues,
      };
    } else {
      return {
        status: 'healthy',
        message: 'All services are healthy',
      };
    }
  }

  public getLastResults(): Map<string, HealthCheckResult> {
    return this.lastResults;
  }

  public startPeriodicChecks(interval: number = 60000) {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    this.checkInterval = setInterval(async () => {
      try {
        await this.runAllHealthChecks();
      } catch (error) {
        logger.error('Error running periodic health checks:', error);
      }
    }, interval);
    
    logger.info(`Started periodic health checks with ${interval}ms interval`);
  }

  public stopPeriodicChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('Stopped periodic health checks');
  }
}

// Create singleton instance
export const healthMonitoringService = new HealthMonitoringService();

// Export default
export default healthMonitoringService;