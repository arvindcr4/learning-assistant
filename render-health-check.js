#!/usr/bin/env node

/**
 * Enhanced Health Check Script for Render.com Deployment
 * This script performs comprehensive health checks for the Learning Assistant application
 * including database connectivity, Redis cache, and application-specific health metrics.
 */

const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  port: process.env.PORT || 3000,
  hostname: process.env.HOSTNAME || 'localhost',
  timeout: 10000,
  retries: 3,
  retryDelay: 2000,
  verbose: process.env.VERBOSE_HEALTH_CHECK === 'true',
  healthEndpoint: '/api/health',
  environment: process.env.NODE_ENV || 'development',
};

// Health check results
const healthResults = {
  timestamp: new Date().toISOString(),
  environment: CONFIG.environment,
  checks: {},
  overall: 'unknown',
  duration: 0,
  version: process.env.npm_package_version || '1.0.0',
};

// Utility functions
const log = (message, level = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (CONFIG.verbose || level === 'error') {
    console.log(`${prefix} ${message}`);
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Health check functions
const checkApplicationHealth = async () => {
  log('Checking application health endpoint...');
  
  return new Promise((resolve) => {
    const protocol = process.env.HTTPS === 'true' ? https : http;
    const options = {
      hostname: CONFIG.hostname,
      port: CONFIG.port,
      path: CONFIG.healthEndpoint,
      method: 'GET',
      timeout: CONFIG.timeout,
      headers: {
        'User-Agent': 'Render-Health-Check/1.0',
        'Accept': 'application/json',
      },
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200 && response.status === 'healthy') {
            resolve({
              status: 'healthy',
              statusCode: res.statusCode,
              responseTime: Date.now() - startTime,
              details: response,
            });
          } else {
            resolve({
              status: 'unhealthy',
              statusCode: res.statusCode,
              responseTime: Date.now() - startTime,
              error: `Unhealthy status: ${response.status}`,
              details: response,
            });
          }
        } catch (error) {
          resolve({
            status: 'unhealthy',
            statusCode: res.statusCode,
            responseTime: Date.now() - startTime,
            error: `Invalid JSON response: ${error.message}`,
            rawResponse: data,
          });
        }
      });
    });

    const startTime = Date.now();
    
    req.on('error', (error) => {
      resolve({
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        code: error.code,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 'unhealthy',
        responseTime: CONFIG.timeout,
        error: 'Request timeout',
      });
    });

    req.end();
  });
};

const checkDatabaseConnectivity = async () => {
  log('Checking database connectivity...');
  
  if (!process.env.DB_HOST || !process.env.DB_PORT) {
    return {
      status: 'skipped',
      message: 'Database configuration not provided',
    };
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    
    exec(`pg_isready -h ${process.env.DB_HOST} -p ${process.env.DB_PORT} -U ${process.env.DB_USER}`, 
      { timeout: CONFIG.timeout }, 
      (error, stdout, stderr) => {
        const responseTime = Date.now() - startTime;
        
        if (error) {
          resolve({
            status: 'unhealthy',
            responseTime,
            error: error.message,
            stderr: stderr,
          });
        } else {
          resolve({
            status: 'healthy',
            responseTime,
            message: 'Database is accepting connections',
            stdout: stdout.trim(),
          });
        }
      }
    );
  });
};

const checkRedisConnectivity = async () => {
  log('Checking Redis connectivity...');
  
  if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
    return {
      status: 'skipped',
      message: 'Redis configuration not provided',
    };
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    const net = require('net');
    
    const socket = new net.Socket();
    socket.setTimeout(CONFIG.timeout);
    
    socket.connect(process.env.REDIS_PORT, process.env.REDIS_HOST, () => {
      socket.write('PING\r\n');
    });
    
    socket.on('data', (data) => {
      const response = data.toString();
      socket.destroy();
      
      if (response.includes('PONG')) {
        resolve({
          status: 'healthy',
          responseTime: Date.now() - startTime,
          message: 'Redis is responding to PING',
        });
      } else {
        resolve({
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: 'Unexpected Redis response',
          response: response,
        });
      }
    });
    
    socket.on('error', (error) => {
      resolve({
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        code: error.code,
      });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        status: 'unhealthy',
        responseTime: CONFIG.timeout,
        error: 'Redis connection timeout',
      });
    });
  });
};

const checkFileSystem = async () => {
  log('Checking file system health...');
  
  const checks = [];
  const requiredPaths = [
    { path: '.next', type: 'directory', required: true },
    { path: 'package.json', type: 'file', required: true },
    { path: 'tmp', type: 'directory', required: false },
    { path: 'logs', type: 'directory', required: false },
  ];

  for (const { path: checkPath, type, required } of requiredPaths) {
    try {
      const stats = fs.statSync(checkPath);
      const isCorrectType = type === 'directory' ? stats.isDirectory() : stats.isFile();
      
      checks.push({
        path: checkPath,
        status: isCorrectType ? 'healthy' : 'unhealthy',
        type: type,
        exists: true,
        size: type === 'file' ? stats.size : undefined,
        modified: stats.mtime,
      });
    } catch (error) {
      checks.push({
        path: checkPath,
        status: required ? 'unhealthy' : 'warning',
        type: type,
        exists: false,
        error: error.message,
      });
    }
  }

  const unhealthyChecks = checks.filter(check => check.status === 'unhealthy');
  
  return {
    status: unhealthyChecks.length === 0 ? 'healthy' : 'unhealthy',
    checks: checks,
    summary: {
      total: checks.length,
      healthy: checks.filter(check => check.status === 'healthy').length,
      unhealthy: unhealthyChecks.length,
      warnings: checks.filter(check => check.status === 'warning').length,
    },
  };
};

const checkSystemResources = async () => {
  log('Checking system resources...');
  
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const uptime = process.uptime();
  
  // Memory checks
  const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  const memoryStatus = memoryUsagePercent > 90 ? 'unhealthy' : 
                      memoryUsagePercent > 70 ? 'warning' : 'healthy';
  
  // Disk space check (if possible)
  let diskSpace = null;
  try {
    await new Promise((resolve, reject) => {
      exec('df -h .', (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          const lines = stdout.split('\n');
          const dataLine = lines[1];
          if (dataLine) {
            const parts = dataLine.split(/\s+/);
            diskSpace = {
              total: parts[1],
              used: parts[2],
              available: parts[3],
              usePercent: parts[4],
            };
          }
          resolve();
        }
      });
    });
  } catch (error) {
    log(`Could not check disk space: ${error.message}`, 'warning');
  }
  
  return {
    status: memoryStatus,
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers,
      usagePercent: memoryUsagePercent,
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    uptime: uptime,
    diskSpace: diskSpace,
  };
};

// Main health check function
const runHealthCheck = async () => {
  const startTime = Date.now();
  log('Starting comprehensive health check...');
  
  try {
    // Run all health checks in parallel
    const [appHealth, dbHealth, redisHealth, fsHealth, resourceHealth] = await Promise.all([
      checkApplicationHealth(),
      checkDatabaseConnectivity(),
      checkRedisConnectivity(),
      checkFileSystem(),
      checkSystemResources(),
    ]);
    
    healthResults.checks = {
      application: appHealth,
      database: dbHealth,
      redis: redisHealth,
      filesystem: fsHealth,
      resources: resourceHealth,
    };
    
    // Determine overall health
    const criticalChecks = [appHealth, dbHealth, fsHealth];
    const unhealthyChecks = criticalChecks.filter(check => check.status === 'unhealthy');
    const warningChecks = Object.values(healthResults.checks).filter(check => check.status === 'warning');
    
    if (unhealthyChecks.length === 0) {
      healthResults.overall = warningChecks.length > 0 ? 'degraded' : 'healthy';
    } else {
      healthResults.overall = 'unhealthy';
    }
    
    healthResults.duration = Date.now() - startTime;
    
    log(`Health check completed in ${healthResults.duration}ms - Overall status: ${healthResults.overall}`);
    
    return healthResults;
    
  } catch (error) {
    log(`Health check failed: ${error.message}`, 'error');
    healthResults.overall = 'unhealthy';
    healthResults.error = error.message;
    healthResults.duration = Date.now() - startTime;
    return healthResults;
  }
};

// Retry mechanism
const runHealthCheckWithRetry = async () => {
  for (let attempt = 1; attempt <= CONFIG.retries; attempt++) {
    log(`Health check attempt ${attempt}/${CONFIG.retries}`);
    
    const result = await runHealthCheck();
    
    if (result.overall === 'healthy' || result.overall === 'degraded') {
      return result;
    }
    
    if (attempt < CONFIG.retries) {
      log(`Health check failed, retrying in ${CONFIG.retryDelay}ms...`, 'warning');
      await sleep(CONFIG.retryDelay);
    }
  }
  
  return healthResults;
};

// Main execution
const main = async () => {
  try {
    const result = await runHealthCheckWithRetry();
    
    // Output results
    if (CONFIG.verbose) {
      console.log(JSON.stringify(result, null, 2));
    }
    
    // Exit with appropriate code
    const exitCode = result.overall === 'healthy' ? 0 : 
                    result.overall === 'degraded' ? 1 : 2;
    
    log(`Health check completed with exit code ${exitCode}`);
    process.exit(exitCode);
    
  } catch (error) {
    log(`Fatal error during health check: ${error.message}`, 'error');
    process.exit(3);
  }
};

// Handle process signals
process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down health check...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('Received SIGINT, shutting down health check...');
  process.exit(0);
});

// Run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  runHealthCheck,
  runHealthCheckWithRetry,
  CONFIG,
};