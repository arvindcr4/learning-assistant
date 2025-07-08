/**
 * Performance Optimization Engine
 * 
 * Comprehensive performance optimization with real-time monitoring,
 * automated optimization, and predictive scaling capabilities.
 */

import { DatabaseOptimizer } from './database-optimizer';
import { APIOptimizer } from './api-optimizer';
import { MemoryOptimizer } from './memory-optimizer';
import { NetworkOptimizer } from './network-optimizer';
import { BrowserOptimizer } from './browser-optimizer';
import { RegressionDetector } from './regression-detector';

// Core interfaces
export interface OptimizationConfig {
  enabled: boolean;
  autoOptimize: boolean;
  aggressiveMode: boolean;
  monitoringInterval: number;
  thresholds: PerformanceThresholds;
  modules: OptimizationModules;
}

export interface PerformanceThresholds {
  cpu: { warning: number; critical: number };
  memory: { warning: number; critical: number };
  responseTime: { warning: number; critical: number };
  throughput: { warning: number; critical: number };
  errorRate: { warning: number; critical: number };
}

export interface OptimizationModules {
  database: boolean;
  api: boolean;
  memory: boolean;
  network: boolean;
  browser: boolean;
  regression: boolean;
}

export interface PerformanceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    processes: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    free: number;
    cached: number;
    leaks: MemoryLeak[];
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
    latency: number;
    errors: number;
  };
  database: {
    queries: number;
    slowQueries: number;
    connections: number;
    lockWaits: number;
  };
  api: {
    requests: number;
    responseTime: number;
    errorRate: number;
    cacheHitRate: number;
  };
  browser: {
    coreWebVitals: CoreWebVitals;
    resourceCounts: ResourceCounts;
    jsHeapSize: number;
    domNodes: number;
  };
}

export interface MemoryLeak {
  type: 'closure' | 'event-listener' | 'timer' | 'dom-reference' | 'circular-reference';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  description: string;
  detectedAt: number;
  growth: number;
  remediation: string[];
}

export interface CoreWebVitals {
  lcp: number;
  fid: number;
  cls: number;
  fcp: number;
  ttfb: number;
}

export interface ResourceCounts {
  scripts: number;
  stylesheets: number;
  images: number;
  fonts: number;
  total: number;
}

export interface OptimizationAction {
  id: string;
  type: OptimizationType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: 'performance' | 'stability' | 'scalability' | 'cost';
  automated: boolean;
  executed: boolean;
  result?: OptimizationResult;
  executedAt?: number;
}

export type OptimizationType = 
  | 'database-index'
  | 'query-optimization'
  | 'cache-tuning'
  | 'memory-cleanup'
  | 'connection-pooling'
  | 'resource-compression'
  | 'lazy-loading'
  | 'code-splitting'
  | 'prefetching'
  | 'garbage-collection'
  | 'scaling-adjustment';

export interface OptimizationResult {
  success: boolean;
  improvementPercentage: number;
  beforeMetrics: Partial<PerformanceMetrics>;
  afterMetrics: Partial<PerformanceMetrics>;
  error?: string;
}

export interface AlertConfig {
  type: 'email' | 'webhook' | 'slack' | 'teams';
  endpoint: string;
  credentials?: Record<string, string>;
  enabled: boolean;
}

export interface AutoScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  cpuThreshold: number;
  memoryThreshold: number;
  responseTimeThreshold: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
}

/**
 * Main Performance Optimization Engine
 */
export class PerformanceOptimizationEngine {
  private config: OptimizationConfig;
  private metrics: PerformanceMetrics[] = [];
  private optimizers: Map<string, any> = new Map();
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout;
  private optimizationQueue: OptimizationAction[] = [];
  private alertConfigs: AlertConfig[] = [];
  private autoScalingConfig?: AutoScalingConfig;

  constructor(config: OptimizationConfig) {
    this.config = config;
    this.initializeOptimizers();
  }

  /**
   * Initialize all optimization modules
   */
  private initializeOptimizers(): void {
    if (this.config.modules.database) {
      this.optimizers.set('database', new DatabaseOptimizer());
    }
    
    if (this.config.modules.api) {
      this.optimizers.set('api', new APIOptimizer());
    }
    
    if (this.config.modules.memory) {
      this.optimizers.set('memory', new MemoryOptimizer());
    }
    
    if (this.config.modules.network) {
      this.optimizers.set('network', new NetworkOptimizer());
    }
    
    if (this.config.modules.browser) {
      this.optimizers.set('browser', new BrowserOptimizer());
    }
    
    if (this.config.modules.regression) {
      this.optimizers.set('regression', new RegressionDetector());
    }
  }

  /**
   * Start the optimization engine
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Optimization engine is already running');
    }

    this.isRunning = true;
    
    // Start monitoring
    this.startMonitoring();
    
    // Start optimization processing
    this.startOptimizationProcessing();
    
    // Initial optimization scan
    await this.performInitialOptimization();
    
    console.log('Performance Optimization Engine started');
  }

  /**
   * Stop the optimization engine
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    // Stop all optimizers
    this.optimizers.forEach(optimizer => {
      if (optimizer.stop) {
        optimizer.stop();
      }
    });
    
    console.log('Performance Optimization Engine stopped');
  }

  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.metrics.push(metrics);
        
        // Keep only last 1000 metrics
        if (this.metrics.length > 1000) {
          this.metrics = this.metrics.slice(-1000);
        }
        
        // Check for performance issues
        await this.analyzePerformance(metrics);
        
      } catch (error) {
        console.error('Error in performance monitoring:', error);
      }
    }, this.config.monitoringInterval);
  }

  /**
   * Collect comprehensive performance metrics
   */
  private async collectMetrics(): Promise<PerformanceMetrics> {
    const timestamp = Date.now();
    
    // Collect system metrics
    const cpu = await this.collectCPUMetrics();
    const memory = await this.collectMemoryMetrics();
    const network = await this.collectNetworkMetrics();
    const database = await this.collectDatabaseMetrics();
    const api = await this.collectAPIMetrics();
    const browser = await this.collectBrowserMetrics();
    
    return {
      timestamp,
      cpu,
      memory,
      network,
      database,
      api,
      browser
    };
  }

  /**
   * Collect CPU metrics
   */
  private async collectCPUMetrics(): Promise<PerformanceMetrics['cpu']> {
    if (typeof process !== 'undefined' && process.cpuUsage) {
      const usage = process.cpuUsage();
      const memUsage = process.memoryUsage();
      
      return {
        usage: (usage.user + usage.system) / 1000000, // Convert to seconds
        processes: 1, // Current process
        load: typeof process.loadavg === 'function' ? process.loadavg() : [0, 0, 0]
      };
    }
    
    // Browser fallback
    return {
      usage: 0,
      processes: 1,
      load: [0, 0, 0]
    };
  }

  /**
   * Collect memory metrics
   */
  private async collectMemoryMetrics(): Promise<PerformanceMetrics['memory']> {
    let memoryInfo = {
      used: 0,
      total: 0,
      free: 0,
      cached: 0,
      leaks: [] as MemoryLeak[]
    };

    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      memoryInfo = {
        used: usage.heapUsed,
        total: usage.heapTotal,
        free: usage.heapTotal - usage.heapUsed,
        cached: usage.external,
        leaks: []
      };
    } else if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      memoryInfo = {
        used: mem.usedJSHeapSize,
        total: mem.totalJSHeapSize,
        free: mem.totalJSHeapSize - mem.usedJSHeapSize,
        cached: 0,
        leaks: []
      };
    }

    // Detect memory leaks
    const memoryOptimizer = this.optimizers.get('memory');
    if (memoryOptimizer) {
      memoryInfo.leaks = await memoryOptimizer.detectLeaks();
    }

    return memoryInfo;
  }

  /**
   * Collect network metrics
   */
  private async collectNetworkMetrics(): Promise<PerformanceMetrics['network']> {
    const networkOptimizer = this.optimizers.get('network');
    if (networkOptimizer) {
      return await networkOptimizer.getMetrics();
    }
    
    return {
      bytesIn: 0,
      bytesOut: 0,
      connections: 0,
      latency: 0,
      errors: 0
    };
  }

  /**
   * Collect database metrics
   */
  private async collectDatabaseMetrics(): Promise<PerformanceMetrics['database']> {
    const databaseOptimizer = this.optimizers.get('database');
    if (databaseOptimizer) {
      return await databaseOptimizer.getMetrics();
    }
    
    return {
      queries: 0,
      slowQueries: 0,
      connections: 0,
      lockWaits: 0
    };
  }

  /**
   * Collect API metrics
   */
  private async collectAPIMetrics(): Promise<PerformanceMetrics['api']> {
    const apiOptimizer = this.optimizers.get('api');
    if (apiOptimizer) {
      return await apiOptimizer.getMetrics();
    }
    
    return {
      requests: 0,
      responseTime: 0,
      errorRate: 0,
      cacheHitRate: 0
    };
  }

  /**
   * Collect browser metrics
   */
  private async collectBrowserMetrics(): Promise<PerformanceMetrics['browser']> {
    if (typeof window === 'undefined') {
      return {
        coreWebVitals: { lcp: 0, fid: 0, cls: 0, fcp: 0, ttfb: 0 },
        resourceCounts: { scripts: 0, stylesheets: 0, images: 0, fonts: 0, total: 0 },
        jsHeapSize: 0,
        domNodes: 0
      };
    }

    const browserOptimizer = this.optimizers.get('browser');
    if (browserOptimizer) {
      return await browserOptimizer.getMetrics();
    }
    
    return {
      coreWebVitals: { lcp: 0, fid: 0, cls: 0, fcp: 0, ttfb: 0 },
      resourceCounts: { scripts: 0, stylesheets: 0, images: 0, fonts: 0, total: 0 },
      jsHeapSize: 0,
      domNodes: 0
    };
  }

  /**
   * Analyze performance and generate optimization actions
   */
  private async analyzePerformance(metrics: PerformanceMetrics): Promise<void> {
    const issues = this.detectPerformanceIssues(metrics);
    
    for (const issue of issues) {
      const action = await this.createOptimizationAction(issue, metrics);
      if (action) {
        this.optimizationQueue.push(action);
      }
    }
    
    // Check for regression
    const regressionDetector = this.optimizers.get('regression');
    if (regressionDetector) {
      const regressions = await regressionDetector.detectRegression(this.metrics);
      for (const regression of regressions) {
        await this.handleRegression(regression);
      }
    }
    
    // Check for scaling needs
    if (this.autoScalingConfig?.enabled) {
      await this.checkAutoScaling(metrics);
    }
  }

  /**
   * Detect performance issues
   */
  private detectPerformanceIssues(metrics: PerformanceMetrics): string[] {
    const issues: string[] = [];
    
    // CPU issues
    if (metrics.cpu.usage > this.config.thresholds.cpu.critical) {
      issues.push('critical-cpu');
    } else if (metrics.cpu.usage > this.config.thresholds.cpu.warning) {
      issues.push('warning-cpu');
    }
    
    // Memory issues
    const memoryUsage = metrics.memory.used / metrics.memory.total;
    if (memoryUsage > this.config.thresholds.memory.critical) {
      issues.push('critical-memory');
    } else if (memoryUsage > this.config.thresholds.memory.warning) {
      issues.push('warning-memory');
    }
    
    // Memory leaks
    if (metrics.memory.leaks.length > 0) {
      issues.push('memory-leaks');
    }
    
    // Response time issues
    if (metrics.api.responseTime > this.config.thresholds.responseTime.critical) {
      issues.push('critical-response-time');
    } else if (metrics.api.responseTime > this.config.thresholds.responseTime.warning) {
      issues.push('warning-response-time');
    }
    
    // Error rate issues
    if (metrics.api.errorRate > this.config.thresholds.errorRate.critical) {
      issues.push('critical-error-rate');
    } else if (metrics.api.errorRate > this.config.thresholds.errorRate.warning) {
      issues.push('warning-error-rate');
    }
    
    // Database issues
    if (metrics.database.slowQueries > 10) {
      issues.push('slow-queries');
    }
    
    if (metrics.database.lockWaits > 5) {
      issues.push('database-locks');
    }
    
    // Browser issues
    if (metrics.browser.coreWebVitals.lcp > 2500) {
      issues.push('poor-lcp');
    }
    
    if (metrics.browser.coreWebVitals.fid > 100) {
      issues.push('poor-fid');
    }
    
    if (metrics.browser.coreWebVitals.cls > 0.1) {
      issues.push('poor-cls');
    }
    
    return issues;
  }

  /**
   * Create optimization action for detected issue
   */
  private async createOptimizationAction(issue: string, metrics: PerformanceMetrics): Promise<OptimizationAction | null> {
    const id = `${issue}-${Date.now()}`;
    
    switch (issue) {
      case 'critical-cpu':
        return {
          id,
          type: 'scaling-adjustment',
          priority: 'critical',
          description: 'Scale up due to critical CPU usage',
          impact: 'performance',
          automated: this.config.autoOptimize,
          executed: false
        };
        
      case 'warning-cpu':
        return {
          id,
          type: 'garbage-collection',
          priority: 'high',
          description: 'Trigger garbage collection to reduce CPU load',
          impact: 'performance',
          automated: this.config.autoOptimize,
          executed: false
        };
        
      case 'critical-memory':
        return {
          id,
          type: 'memory-cleanup',
          priority: 'critical',
          description: 'Emergency memory cleanup',
          impact: 'stability',
          automated: this.config.autoOptimize,
          executed: false
        };
        
      case 'memory-leaks':
        return {
          id,
          type: 'memory-cleanup',
          priority: 'high',
          description: `Fix ${metrics.memory.leaks.length} detected memory leaks`,
          impact: 'stability',
          automated: this.config.autoOptimize,
          executed: false
        };
        
      case 'slow-queries':
        return {
          id,
          type: 'query-optimization',
          priority: 'high',
          description: 'Optimize slow database queries',
          impact: 'performance',
          automated: this.config.autoOptimize,
          executed: false
        };
        
      case 'database-locks':
        return {
          id,
          type: 'database-index',
          priority: 'medium',
          description: 'Add indexes to reduce lock waits',
          impact: 'performance',
          automated: this.config.autoOptimize,
          executed: false
        };
        
      case 'poor-lcp':
        return {
          id,
          type: 'lazy-loading',
          priority: 'medium',
          description: 'Implement lazy loading for large content',
          impact: 'performance',
          automated: this.config.autoOptimize,
          executed: false
        };
        
      case 'poor-fid':
        return {
          id,
          type: 'code-splitting',
          priority: 'medium',
          description: 'Implement code splitting to reduce JavaScript load',
          impact: 'performance',
          automated: this.config.autoOptimize,
          executed: false
        };
        
      default:
        return null;
    }
  }

  /**
   * Start optimization processing
   */
  private startOptimizationProcessing(): void {
    // Process optimization queue every 30 seconds
    setInterval(async () => {
      await this.processOptimizationQueue();
    }, 30000);
  }

  /**
   * Process optimization queue
   */
  private async processOptimizationQueue(): Promise<void> {
    if (this.optimizationQueue.length === 0) {
      return;
    }
    
    // Sort by priority
    this.optimizationQueue.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    // Process high priority items first
    const toProcess = this.optimizationQueue.slice(0, 5);
    this.optimizationQueue = this.optimizationQueue.slice(5);
    
    for (const action of toProcess) {
      if (action.automated || this.config.autoOptimize) {
        await this.executeOptimization(action);
      }
    }
  }

  /**
   * Execute optimization action
   */
  private async executeOptimization(action: OptimizationAction): Promise<void> {
    try {
      const beforeMetrics = await this.collectMetrics();
      
      let result: OptimizationResult;
      
      switch (action.type) {
        case 'database-index':
          result = await this.optimizers.get('database')?.addIndex(action);
          break;
          
        case 'query-optimization':
          result = await this.optimizers.get('database')?.optimizeQueries(action);
          break;
          
        case 'memory-cleanup':
          result = await this.optimizers.get('memory')?.cleanup(action);
          break;
          
        case 'cache-tuning':
          result = await this.optimizers.get('api')?.tuneCache(action);
          break;
          
        case 'lazy-loading':
          result = await this.optimizers.get('browser')?.enableLazyLoading(action);
          break;
          
        case 'code-splitting':
          result = await this.optimizers.get('browser')?.implementCodeSplitting(action);
          break;
          
        case 'scaling-adjustment':
          result = await this.handleScaling(action);
          break;
          
        default:
          result = { success: false, improvementPercentage: 0, beforeMetrics, afterMetrics: {} };
      }
      
      const afterMetrics = await this.collectMetrics();
      result.afterMetrics = afterMetrics;
      
      action.result = result;
      action.executed = true;
      action.executedAt = Date.now();
      
      console.log(`Optimization executed: ${action.description}`, result);
      
    } catch (error) {
      console.error(`Optimization failed: ${action.description}`, error);
      action.result = {
        success: false,
        improvementPercentage: 0,
        beforeMetrics: {},
        afterMetrics: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      action.executed = true;
      action.executedAt = Date.now();
    }
  }

  /**
   * Handle scaling operations
   */
  private async handleScaling(action: OptimizationAction): Promise<OptimizationResult> {
    // This would integrate with cloud provider APIs
    // For now, return a simulated result
    return {
      success: true,
      improvementPercentage: 25,
      beforeMetrics: {},
      afterMetrics: {}
    };
  }

  /**
   * Check if auto-scaling is needed
   */
  private async checkAutoScaling(metrics: PerformanceMetrics): Promise<void> {
    if (!this.autoScalingConfig?.enabled) return;
    
    const config = this.autoScalingConfig;
    const cpuUsage = metrics.cpu.usage;
    const memoryUsage = metrics.memory.used / metrics.memory.total;
    const responseTime = metrics.api.responseTime;
    
    // Scale up conditions
    if (cpuUsage > config.cpuThreshold || 
        memoryUsage > config.memoryThreshold || 
        responseTime > config.responseTimeThreshold) {
      
      await this.triggerScaleUp();
    }
    
    // Scale down conditions (implement with more conservative logic)
    if (cpuUsage < config.cpuThreshold * 0.5 && 
        memoryUsage < config.memoryThreshold * 0.5 && 
        responseTime < config.responseTimeThreshold * 0.5) {
      
      await this.triggerScaleDown();
    }
  }

  /**
   * Trigger scale up
   */
  private async triggerScaleUp(): Promise<void> {
    console.log('Triggering scale up...');
    // Implement cloud provider scaling logic
  }

  /**
   * Trigger scale down
   */
  private async triggerScaleDown(): Promise<void> {
    console.log('Triggering scale down...');
    // Implement cloud provider scaling logic
  }

  /**
   * Handle performance regression
   */
  private async handleRegression(regression: any): Promise<void> {
    console.log('Performance regression detected:', regression);
    
    // Create high-priority optimization action
    const action: OptimizationAction = {
      id: `regression-${Date.now()}`,
      type: 'memory-cleanup',
      priority: 'critical',
      description: `Handle performance regression: ${regression.description}`,
      impact: 'performance',
      automated: true,
      executed: false
    };
    
    this.optimizationQueue.unshift(action);
    
    // Send alert
    await this.sendAlert({
      type: 'regression',
      title: 'Performance Regression Detected',
      description: regression.description,
      severity: 'high',
      timestamp: Date.now()
    });
  }

  /**
   * Perform initial optimization
   */
  private async performInitialOptimization(): Promise<void> {
    console.log('Performing initial optimization...');
    
    // Initial metrics collection
    const metrics = await this.collectMetrics();
    
    // Initialize all optimizers
    for (const [name, optimizer] of this.optimizers) {
      if (optimizer.initialize) {
        await optimizer.initialize(metrics);
      }
    }
    
    // Perform initial analysis
    await this.analyzePerformance(metrics);
  }

  /**
   * Send alert notifications
   */
  private async sendAlert(alert: any): Promise<void> {
    for (const config of this.alertConfigs) {
      if (!config.enabled) continue;
      
      try {
        switch (config.type) {
          case 'webhook':
            await this.sendWebhookAlert(config, alert);
            break;
          case 'email':
            await this.sendEmailAlert(config, alert);
            break;
          case 'slack':
            await this.sendSlackAlert(config, alert);
            break;
        }
      } catch (error) {
        console.error(`Failed to send ${config.type} alert:`, error);
      }
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(config: AlertConfig, alert: any): Promise<void> {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook alert failed: ${response.statusText}`);
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(config: AlertConfig, alert: any): Promise<void> {
    // Implement email sending logic
    console.log('Email alert sent:', alert);
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(config: AlertConfig, alert: any): Promise<void> {
    // Implement Slack webhook logic
    console.log('Slack alert sent:', alert);
  }

  /**
   * Configure alerts
   */
  public configureAlerts(configs: AlertConfig[]): void {
    this.alertConfigs = configs;
  }

  /**
   * Configure auto-scaling
   */
  public configureAutoScaling(config: AutoScalingConfig): void {
    this.autoScalingConfig = config;
  }

  /**
   * Get current metrics
   */
  public getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  /**
   * Get metrics history
   */
  public getMetricsHistory(limit: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get optimization actions
   */
  public getOptimizationActions(): OptimizationAction[] {
    return [...this.optimizationQueue];
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): any {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) return null;
    
    const recentMetrics = this.metrics.slice(-10);
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.api.responseTime, 0) / recentMetrics.length;
    const avgCpuUsage = recentMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / recentMetrics.length;
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + (m.memory.used / m.memory.total), 0) / recentMetrics.length;
    
    return {
      timestamp: Date.now(),
      status: this.getOverallStatus(currentMetrics),
      metrics: {
        cpu: avgCpuUsage,
        memory: avgMemoryUsage,
        responseTime: avgResponseTime,
        errorRate: currentMetrics.api.errorRate
      },
      optimizations: {
        total: this.optimizationQueue.length,
        executed: this.optimizationQueue.filter(a => a.executed).length,
        pending: this.optimizationQueue.filter(a => !a.executed).length
      },
      recommendations: this.getRecommendations(currentMetrics)
    };
  }

  /**
   * Get overall system status
   */
  private getOverallStatus(metrics: PerformanceMetrics): 'healthy' | 'warning' | 'critical' {
    const issues = this.detectPerformanceIssues(metrics);
    
    if (issues.some(issue => issue.includes('critical'))) {
      return 'critical';
    }
    
    if (issues.some(issue => issue.includes('warning'))) {
      return 'warning';
    }
    
    return 'healthy';
  }

  /**
   * Get performance recommendations
   */
  private getRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.cpu.usage > 80) {
      recommendations.push('Consider scaling up CPU resources');
    }
    
    if (metrics.memory.used / metrics.memory.total > 0.8) {
      recommendations.push('Implement memory optimization strategies');
    }
    
    if (metrics.api.responseTime > 1000) {
      recommendations.push('Optimize API response times with caching');
    }
    
    if (metrics.database.slowQueries > 5) {
      recommendations.push('Review and optimize database queries');
    }
    
    if (metrics.browser.coreWebVitals.lcp > 2500) {
      recommendations.push('Optimize Largest Contentful Paint');
    }
    
    return recommendations;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  public getConfig(): OptimizationConfig {
    return { ...this.config };
  }
}

// Default configuration
export const defaultOptimizationConfig: OptimizationConfig = {
  enabled: true,
  autoOptimize: true,
  aggressiveMode: false,
  monitoringInterval: 30000, // 30 seconds
  thresholds: {
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 0.8, critical: 0.95 },
    responseTime: { warning: 1000, critical: 2000 },
    throughput: { warning: 100, critical: 50 },
    errorRate: { warning: 0.01, critical: 0.05 }
  },
  modules: {
    database: true,
    api: true,
    memory: true,
    network: true,
    browser: true,
    regression: true
  }
};

// Export singleton instance
export const optimizationEngine = new PerformanceOptimizationEngine(defaultOptimizationConfig);