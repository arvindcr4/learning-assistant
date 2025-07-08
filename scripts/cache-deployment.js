#!/usr/bin/env node

/**
 * Cache Deployment Automation Script
 * 
 * This script handles cache warming and invalidation for production deployments.
 * It can be integrated into CI/CD pipelines for automated cache management.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
  environment: process.env.NODE_ENV || 'production',
  apiUrl: process.env.CACHE_API_URL || 'http://localhost:3000/api',
  apiKey: process.env.CACHE_API_KEY || '',
  timeout: parseInt(process.env.CACHE_TIMEOUT || '300000'), // 5 minutes
  retryAttempts: parseInt(process.env.CACHE_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.CACHE_RETRY_DELAY || '5000'),
  logLevel: process.env.CACHE_LOG_LEVEL || 'info',
};

// Deployment strategies
const DEPLOYMENT_STRATEGIES = {
  'blue-green': {
    name: 'Blue-Green Deployment',
    description: 'Warm new environment cache while keeping old environment active',
    phases: ['pre-warm', 'switch', 'cleanup'],
  },
  'rolling': {
    name: 'Rolling Deployment',
    description: 'Gradually warm cache as instances are updated',
    phases: ['progressive-warm', 'invalidate-old'],
  },
  'canary': {
    name: 'Canary Deployment',
    description: 'Warm cache for small percentage of traffic first',
    phases: ['canary-warm', 'full-warm', 'cleanup'],
  },
  'maintenance': {
    name: 'Maintenance Window',
    description: 'Full cache refresh during maintenance window',
    phases: ['invalidate-all', 'full-warm', 'verify'],
  },
};

// Cache warming patterns by application area
const WARMING_PATTERNS = {
  authentication: [
    'user:profile:*',
    'session:*',
    'auth:tokens:*',
  ],
  content: [
    'content:courses:*',
    'content:lessons:*',
    'content:exercises:*',
    'content:assessments:*',
  ],
  analytics: [
    'analytics:user-progress:*',
    'analytics:learning-paths:*',
    'analytics:performance:*',
  ],
  configuration: [
    'config:feature-flags:*',
    'config:learning-settings:*',
    'config:ui-preferences:*',
  ],
  api: [
    'api:rate-limits:*',
    'api:responses:popular:*',
    'api:metadata:*',
  ],
};

// Utility functions
class Logger {
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(data && { data }),
    };

    if (CONFIG.logLevel === 'debug' || 
        (CONFIG.logLevel === 'info' && ['info', 'warn', 'error'].includes(level)) ||
        (CONFIG.logLevel === 'warn' && ['warn', 'error'].includes(level)) ||
        (CONFIG.logLevel === 'error' && level === 'error')) {
      console.log(JSON.stringify(logEntry));
    }
  }

  static debug(message, data) { this.log('debug', message, data); }
  static info(message, data) { this.log('info', message, data); }
  static warn(message, data) { this.log('warn', message, data); }
  static error(message, data) { this.log('error', message, data); }
}

class CacheAPI {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
    };

    const config = {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) }),
    };

    Logger.debug(`Making ${method} request to ${url}`, { body });

    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      Logger.debug(`Received response from ${url}`, { status: response.status, data });
      
      return data;
    } catch (error) {
      Logger.error(`Request failed: ${url}`, { error: error.message });
      throw error;
    }
  }

  async warmCache(patterns, namespace = 'default', strategy = 'adaptive') {
    return this.makeRequest('/cache/warm', 'POST', {
      patterns,
      namespace,
      strategy,
    });
  }

  async invalidateCache(patterns, namespaces = ['default'], options = {}) {
    return this.makeRequest('/cache/invalidate', 'POST', {
      patterns,
      namespaces,
      ...options,
    });
  }

  async getCacheHealth() {
    return this.makeRequest('/health/cache');
  }

  async getCacheMetrics() {
    return this.makeRequest('/cache/metrics');
  }

  async getJobStatus(jobId) {
    return this.makeRequest(`/cache/jobs/${jobId}`);
  }
}

class CacheDeploymentManager {
  constructor() {
    this.api = new CacheAPI(CONFIG.apiUrl, CONFIG.apiKey);
    this.deploymentId = `deploy-${Date.now()}`;
    this.jobIds = [];
  }

  async executeDeployment(strategy, options = {}) {
    Logger.info(`Starting cache deployment with strategy: ${strategy}`, {
      deploymentId: this.deploymentId,
      options,
    });

    try {
      const deploymentStrategy = DEPLOYMENT_STRATEGIES[strategy];
      if (!deploymentStrategy) {
        throw new Error(`Unknown deployment strategy: ${strategy}`);
      }

      Logger.info(`Executing ${deploymentStrategy.name}`, {
        description: deploymentStrategy.description,
        phases: deploymentStrategy.phases,
      });

      // Execute phases based on strategy
      for (const phase of deploymentStrategy.phases) {
        await this.executePhase(phase, options);
      }

      Logger.info('Cache deployment completed successfully', {
        deploymentId: this.deploymentId,
        strategy,
        jobsExecuted: this.jobIds.length,
      });

      return {
        success: true,
        deploymentId: this.deploymentId,
        jobIds: this.jobIds,
      };
    } catch (error) {
      Logger.error('Cache deployment failed', {
        deploymentId: this.deploymentId,
        strategy,
        error: error.message,
      });

      // Attempt rollback
      await this.rollback();
      throw error;
    }
  }

  async executePhase(phase, options) {
    Logger.info(`Executing deployment phase: ${phase}`, { deploymentId: this.deploymentId });

    switch (phase) {
      case 'pre-warm':
        await this.preWarmCache(options);
        break;
      
      case 'progressive-warm':
        await this.progressiveWarmCache(options);
        break;
      
      case 'canary-warm':
        await this.canaryWarmCache(options);
        break;
      
      case 'full-warm':
        await this.fullWarmCache(options);
        break;
      
      case 'invalidate-all':
        await this.invalidateAllCache(options);
        break;
      
      case 'invalidate-old':
        await this.invalidateOldCache(options);
        break;
      
      case 'switch':
        await this.switchTraffic(options);
        break;
      
      case 'cleanup':
        await this.cleanupCache(options);
        break;
      
      case 'verify':
        await this.verifyCache(options);
        break;
      
      default:
        Logger.warn(`Unknown deployment phase: ${phase}`);
    }
  }

  async preWarmCache(options) {
    Logger.info('Starting pre-deployment cache warming');

    const areas = options.areas || Object.keys(WARMING_PATTERNS);
    const namespaces = options.namespaces || ['default', 'content', 'sessions'];

    for (const area of areas) {
      const patterns = WARMING_PATTERNS[area];
      if (!patterns) {
        Logger.warn(`Unknown warming area: ${area}`);
        continue;
      }

      for (const namespace of namespaces) {
        Logger.info(`Warming ${area} cache in namespace: ${namespace}`);
        
        try {
          const response = await this.api.warmCache(patterns, namespace, 'predictive');
          this.jobIds.push(response.jobId);
          
          Logger.info(`Cache warming job scheduled`, {
            area,
            namespace,
            jobId: response.jobId,
            patterns,
          });
        } catch (error) {
          Logger.error(`Failed to warm ${area} cache in ${namespace}`, {
            error: error.message,
            patterns,
          });
        }
      }
    }

    // Wait for warming jobs to complete
    await this.waitForJobs(this.jobIds, 'warming');
  }

  async progressiveWarmCache(options) {
    Logger.info('Starting progressive cache warming');

    const batchSize = options.batchSize || 3;
    const delay = options.delay || 30000; // 30 seconds

    const allPatterns = Object.values(WARMING_PATTERNS).flat();
    const batches = this.chunkArray(allPatterns, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      Logger.info(`Warming cache batch ${i + 1}/${batches.length}`, { patterns: batch });

      try {
        const response = await this.api.warmCache(batch, 'default', 'adaptive');
        this.jobIds.push(response.jobId);

        // Wait for this batch to complete before starting next
        await this.waitForJobs([response.jobId], 'warming');

        if (i < batches.length - 1) {
          Logger.info(`Waiting ${delay}ms before next batch`);
          await this.sleep(delay);
        }
      } catch (error) {
        Logger.error(`Failed to warm cache batch ${i + 1}`, {
          error: error.message,
          patterns: batch,
        });
      }
    }
  }

  async canaryWarmCache(options) {
    Logger.info('Starting canary cache warming');

    const canaryPercentage = options.canaryPercentage || 10;
    const criticalPatterns = options.criticalPatterns || [
      'user:profile:*',
      'content:courses:popular:*',
      'config:feature-flags:*',
    ];

    Logger.info(`Warming critical patterns for ${canaryPercentage}% of traffic`, {
      patterns: criticalPatterns,
    });

    try {
      const response = await this.api.warmCache(criticalPatterns, 'default', 'predictive');
      this.jobIds.push(response.jobId);
      
      await this.waitForJobs([response.jobId], 'warming');
      
      // Verify canary performance
      await this.verifyCanaryPerformance(options);
    } catch (error) {
      Logger.error('Canary cache warming failed', { error: error.message });
      throw error;
    }
  }

  async fullWarmCache(options) {
    Logger.info('Starting full cache warming');

    const allPatterns = Object.values(WARMING_PATTERNS).flat();
    const namespaces = options.namespaces || ['default', 'content', 'sessions', 'analytics'];

    for (const namespace of namespaces) {
      try {
        const response = await this.api.warmCache(allPatterns, namespace, 'hybrid');
        this.jobIds.push(response.jobId);
        
        Logger.info(`Full cache warming scheduled for namespace: ${namespace}`, {
          jobId: response.jobId,
          patternsCount: allPatterns.length,
        });
      } catch (error) {
        Logger.error(`Failed to schedule full warming for ${namespace}`, {
          error: error.message,
        });
      }
    }

    await this.waitForJobs(this.jobIds.slice(-namespaces.length), 'warming');
  }

  async invalidateAllCache(options) {
    Logger.info('Starting full cache invalidation');

    const namespaces = options.namespaces || ['default', 'content', 'sessions', 'analytics'];
    const preservePatterns = options.preservePatterns || ['config:feature-flags:*'];

    try {
      const response = await this.api.invalidateCache(['*'], namespaces, {
        strategy: 'batch',
        preservePatterns,
        cascading: true,
      });

      this.jobIds.push(response.jobId);
      Logger.info('Cache invalidation job scheduled', {
        jobId: response.jobId,
        namespaces,
        preservePatterns,
      });

      await this.waitForJobs([response.jobId], 'invalidation');
    } catch (error) {
      Logger.error('Full cache invalidation failed', { error: error.message });
      throw error;
    }
  }

  async invalidateOldCache(options) {
    Logger.info('Starting old cache invalidation');

    const maxAge = options.maxAge || 3600000; // 1 hour
    const cutoffTime = Date.now() - maxAge;

    try {
      const response = await this.api.invalidateCache(['*'], ['default'], {
        strategy: 'selective',
        conditions: [`lastAccessed < ${cutoffTime}`],
        cascading: false,
      });

      this.jobIds.push(response.jobId);
      await this.waitForJobs([response.jobId], 'invalidation');
    } catch (error) {
      Logger.error('Old cache invalidation failed', { error: error.message });
    }
  }

  async switchTraffic(options) {
    Logger.info('Switching traffic to new environment');
    
    // This would typically involve load balancer configuration
    // For now, we'll just log the action
    Logger.info('Traffic switching completed', {
      from: options.oldEnvironment || 'blue',
      to: options.newEnvironment || 'green',
    });
  }

  async cleanupCache(options) {
    Logger.info('Starting cache cleanup');

    const cleanupPatterns = options.cleanupPatterns || [
      'temp:*',
      'session:expired:*',
      'api:responses:old:*',
    ];

    try {
      const response = await this.api.invalidateCache(cleanupPatterns, ['default'], {
        strategy: 'lazy',
        cascading: false,
      });

      this.jobIds.push(response.jobId);
      await this.waitForJobs([response.jobId], 'invalidation');
    } catch (error) {
      Logger.error('Cache cleanup failed', { error: error.message });
    }
  }

  async verifyCache(options) {
    Logger.info('Verifying cache health and performance');

    try {
      const health = await this.api.getCacheHealth();
      const metrics = await this.api.getCacheMetrics();

      const healthCheck = {
        status: health.status,
        hitRate: metrics.memoryCache?.hitRate || 0,
        responseTime: metrics.memoryCache?.avgResponseTime || 0,
        errorRate: metrics.distributedCache?.failedOperations / 
                   Math.max(metrics.distributedCache?.totalOperations, 1) * 100,
      };

      Logger.info('Cache verification completed', { healthCheck });

      // Define thresholds
      const thresholds = {
        minHitRate: options.minHitRate || 80,
        maxResponseTime: options.maxResponseTime || 100,
        maxErrorRate: options.maxErrorRate || 1,
      };

      // Check if verification passes
      const issues = [];
      if (healthCheck.hitRate < thresholds.minHitRate) {
        issues.push(`Hit rate ${healthCheck.hitRate}% below threshold ${thresholds.minHitRate}%`);
      }
      if (healthCheck.responseTime > thresholds.maxResponseTime) {
        issues.push(`Response time ${healthCheck.responseTime}ms above threshold ${thresholds.maxResponseTime}ms`);
      }
      if (healthCheck.errorRate > thresholds.maxErrorRate) {
        issues.push(`Error rate ${healthCheck.errorRate}% above threshold ${thresholds.maxErrorRate}%`);
      }

      if (issues.length > 0) {
        Logger.error('Cache verification failed', { issues, healthCheck });
        throw new Error(`Cache verification failed: ${issues.join(', ')}`);
      }

      Logger.info('Cache verification passed all thresholds');
    } catch (error) {
      Logger.error('Cache verification error', { error: error.message });
      throw error;
    }
  }

  async verifyCanaryPerformance(options) {
    Logger.info('Verifying canary performance');

    // Wait for metrics to stabilize
    await this.sleep(options.stabilizationTime || 60000);

    const metrics = await this.api.getCacheMetrics();
    const canaryThresholds = {
      minHitRate: options.canaryMinHitRate || 70,
      maxResponseTime: options.canaryMaxResponseTime || 150,
    };

    const hitRate = metrics.memoryCache?.hitRate || 0;
    const responseTime = metrics.memoryCache?.avgResponseTime || 0;

    if (hitRate < canaryThresholds.minHitRate || responseTime > canaryThresholds.maxResponseTime) {
      throw new Error(`Canary verification failed: hit rate ${hitRate}%, response time ${responseTime}ms`);
    }

    Logger.info('Canary performance verification passed', {
      hitRate,
      responseTime,
      thresholds: canaryThresholds,
    });
  }

  async waitForJobs(jobIds, type = 'warming') {
    Logger.info(`Waiting for ${jobIds.length} ${type} jobs to complete`, { jobIds });

    const maxWaitTime = CONFIG.timeout;
    const checkInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      let allCompleted = true;

      for (const jobId of jobIds) {
        try {
          const status = await this.api.getJobStatus(jobId);
          
          if (status.status === 'running' || status.status === 'pending') {
            allCompleted = false;
            Logger.debug(`Job ${jobId} still ${status.status}`, {
              progress: status.progress?.percentage || 0,
            });
          } else if (status.status === 'failed') {
            throw new Error(`Job ${jobId} failed: ${status.error}`);
          } else if (status.status === 'completed') {
            Logger.info(`Job ${jobId} completed successfully`, {
              duration: status.duration,
              metrics: status.metrics,
            });
          }
        } catch (error) {
          Logger.error(`Failed to check job status: ${jobId}`, { error: error.message });
          throw error;
        }
      }

      if (allCompleted) {
        Logger.info(`All ${type} jobs completed successfully`);
        return;
      }

      await this.sleep(checkInterval);
    }

    throw new Error(`Timeout waiting for ${type} jobs to complete`);
  }

  async rollback() {
    Logger.warn('Attempting cache deployment rollback');

    try {
      // Cancel any pending jobs
      for (const jobId of this.jobIds) {
        try {
          await this.api.makeRequest(`/cache/jobs/${jobId}/cancel`, 'POST');
          Logger.info(`Cancelled job: ${jobId}`);
        } catch (error) {
          Logger.warn(`Failed to cancel job ${jobId}:`, error.message);
        }
      }

      // Invalidate any partially warmed cache
      await this.api.invalidateCache(['*'], ['default'], {
        strategy: 'immediate',
        cascading: false,
      });

      Logger.info('Cache deployment rollback completed');
    } catch (error) {
      Logger.error('Cache deployment rollback failed', { error: error.message });
    }
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const strategy = args[1] || 'blue-green';

  if (!command) {
    console.log(`
Usage: node cache-deployment.js <command> [strategy] [options]

Commands:
  deploy     - Execute cache deployment
  warm       - Warm cache only
  invalidate - Invalidate cache only
  verify     - Verify cache health
  status     - Check deployment status

Strategies:
  blue-green  - Blue-green deployment (default)
  rolling     - Rolling deployment
  canary      - Canary deployment
  maintenance - Maintenance window deployment

Examples:
  node cache-deployment.js deploy blue-green
  node cache-deployment.js warm
  node cache-deployment.js verify
    `);
    process.exit(1);
  }

  const manager = new CacheDeploymentManager();

  try {
    switch (command) {
      case 'deploy':
        await manager.executeDeployment(strategy);
        break;
      
      case 'warm':
        await manager.fullWarmCache();
        break;
      
      case 'invalidate':
        await manager.invalidateAllCache();
        break;
      
      case 'verify':
        await manager.verifyCache();
        break;
      
      case 'status':
        const health = await manager.api.getCacheHealth();
        console.log(JSON.stringify(health, null, 2));
        break;
      
      default:
        Logger.error(`Unknown command: ${command}`);
        process.exit(1);
    }

    Logger.info('Cache deployment script completed successfully');
    process.exit(0);
  } catch (error) {
    Logger.error('Cache deployment script failed', { error: error.message });
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = {
  CacheDeploymentManager,
  CacheAPI,
  Logger,
  DEPLOYMENT_STRATEGIES,
  WARMING_PATTERNS,
  CONFIG,
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}