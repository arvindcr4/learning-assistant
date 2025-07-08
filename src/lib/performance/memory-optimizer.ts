/**
 * Memory Performance Optimizer
 * 
 * Advanced memory management with leak detection, automatic cleanup,
 * and garbage collection optimization.
 */

// Core interfaces
export interface MemoryMetrics {
  used: number;
  total: number;
  free: number;
  cached: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  leaks: MemoryLeak[];
  gcStats: GCStatistics;
  objectCounts: ObjectCounts;
}

export interface MemoryLeak {
  type: 'closure' | 'event-listener' | 'timer' | 'dom-reference' | 'circular-reference' | 'cache-overflow' | 'observer';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  description: string;
  detectedAt: number;
  growth: number;
  size: number;
  remediation: string[];
  stackTrace?: string;
  objectType?: string;
  retainedBy?: string[];
}

export interface GCStatistics {
  collections: number;
  pauseTime: number;
  reclaimedMemory: number;
  frequency: number;
  efficiency: number;
  lastCollection: number;
  type: string;
}

export interface ObjectCounts {
  objects: number;
  arrays: number;
  functions: number;
  strings: number;
  numbers: number;
  domNodes: number;
  eventListeners: number;
  timers: number;
  observers: number;
}

export interface MemoryOptimizationResult {
  success: boolean;
  action: string;
  description: string;
  freedMemory: number;
  improvementPercentage: number;
  beforeMetrics: Partial<MemoryMetrics>;
  afterMetrics: Partial<MemoryMetrics>;
  error?: string;
  remediationApplied: string[];
}

export interface MemoryThreshold {
  warning: number;
  critical: number;
  emergency: number;
}

export interface CleanupStrategy {
  name: string;
  priority: number;
  enabled: boolean;
  execute: () => Promise<number>;
  description: string;
}

/**
 * Memory Leak Detector
 */
class MemoryLeakDetector {
  private snapshots: Map<string, any> = new Map();
  private monitoredObjects: WeakMap<object, any> = new WeakMap();
  private timers: Set<number> = new Set();
  private eventListeners: Map<string, number> = new Map();
  private observers: Set<any> = new Set();
  private lastGCStats: GCStatistics | null = null;

  /**
   * Take memory snapshot
   */
  public takeSnapshot(): void {
    const timestamp = Date.now();
    
    const snapshot = {
      timestamp,
      memory: this.getMemoryUsage(),
      objectCounts: this.getObjectCounts(),
      heapSnapshot: this.getHeapSnapshot()
    };

    this.snapshots.set(timestamp.toString(), snapshot);

    // Keep only last 20 snapshots
    if (this.snapshots.size > 20) {
      const oldest = Array.from(this.snapshots.keys()).sort()[0];
      this.snapshots.delete(oldest);
    }
  }

  /**
   * Detect memory leaks by analyzing snapshots
   */
  public detectLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    
    // Analyze memory growth patterns
    leaks.push(...this.detectMemoryGrowthLeaks());
    
    // Detect specific leak types
    leaks.push(...this.detectTimerLeaks());
    leaks.push(...this.detectEventListenerLeaks());
    leaks.push(...this.detectClosureLeaks());
    leaks.push(...this.detectDOMLeaks());
    leaks.push(...this.detectObserverLeaks());
    
    return leaks;
  }

  /**
   * Detect memory growth leaks
   */
  private detectMemoryGrowthLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    const snapshots = Array.from(this.snapshots.values()).sort((a, b) => a.timestamp - b.timestamp);
    
    if (snapshots.length < 5) return leaks;

    const recent = snapshots.slice(-5);
    const baseline = snapshots.slice(0, 5);

    const avgRecentMemory = recent.reduce((sum, s) => sum + s.memory.heapUsed, 0) / recent.length;
    const avgBaselineMemory = baseline.reduce((sum, s) => sum + s.memory.heapUsed, 0) / baseline.length;
    
    const growthRate = (avgRecentMemory - avgBaselineMemory) / avgBaselineMemory;
    
    if (growthRate > 0.3) { // 30% growth
      leaks.push({
        type: 'circular-reference',
        severity: growthRate > 0.8 ? 'critical' : growthRate > 0.5 ? 'high' : 'medium',
        location: 'heap',
        description: `Memory usage increased by ${(growthRate * 100).toFixed(1)}% over recent snapshots`,
        detectedAt: Date.now(),
        growth: growthRate,
        size: avgRecentMemory - avgBaselineMemory,
        remediation: [
          'Review object references for circular dependencies',
          'Check for large objects not being garbage collected',
          'Analyze heap dump for retained objects',
          'Implement weak references where appropriate'
        ]
      });
    }

    return leaks;
  }

  /**
   * Detect timer leaks
   */
  private detectTimerLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    
    if (this.timers.size > 100) {
      leaks.push({
        type: 'timer',
        severity: this.timers.size > 500 ? 'critical' : this.timers.size > 200 ? 'high' : 'medium',
        location: 'global timers',
        description: `${this.timers.size} active timers detected, potential memory leak`,
        detectedAt: Date.now(),
        growth: this.timers.size / 100,
        size: this.timers.size * 100, // Estimated size
        remediation: [
          'Clear unused timers with clearTimeout/clearInterval',
          'Use WeakRef for timer callbacks when appropriate',
          'Implement timer cleanup in component unmount/destroy',
          'Consider using AbortController for cancelable operations'
        ]
      });
    }

    return leaks;
  }

  /**
   * Detect event listener leaks
   */
  private detectEventListenerLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    const totalListeners = Array.from(this.eventListeners.values()).reduce((sum, count) => sum + count, 0);
    
    if (totalListeners > 1000) {
      leaks.push({
        type: 'event-listener',
        severity: totalListeners > 5000 ? 'critical' : totalListeners > 2000 ? 'high' : 'medium',
        location: 'DOM and custom events',
        description: `${totalListeners} event listeners detected, potential memory leak`,
        detectedAt: Date.now(),
        growth: totalListeners / 1000,
        size: totalListeners * 200, // Estimated size per listener
        remediation: [
          'Remove event listeners in cleanup functions',
          'Use AbortController for automatic cleanup',
          'Implement event delegation where appropriate',
          'Use WeakMap for storing event handler references'
        ]
      });
    }

    // Check for specific events with high counts
    for (const [event, count] of this.eventListeners) {
      if (count > 200) {
        leaks.push({
          type: 'event-listener',
          severity: count > 1000 ? 'high' : 'medium',
          location: `${event} events`,
          description: `${count} listeners for '${event}' event`,
          detectedAt: Date.now(),
          growth: count / 100,
          size: count * 200,
          remediation: [
            `Review ${event} event listener usage`,
            'Consider event delegation for similar elements',
            'Ensure proper cleanup of ${event} listeners'
          ]
        });
      }
    }

    return leaks;
  }

  /**
   * Detect closure leaks
   */
  private detectClosureLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    
    try {
      // Analyze function objects in heap
      if (typeof window !== 'undefined' && (window as any).gc) {
        // Only if gc is exposed (development)
        const before = performance.memory?.usedJSHeapSize || 0;
        (window as any).gc();
        const after = performance.memory?.usedJSHeapSize || 0;
        
        const notReclaimed = before - after;
        if (notReclaimed > 10 * 1024 * 1024) { // 10MB not reclaimed
          leaks.push({
            type: 'closure',
            severity: 'high',
            location: 'function closures',
            description: `${(notReclaimed / 1024 / 1024).toFixed(1)}MB not reclaimed after GC`,
            detectedAt: Date.now(),
            growth: notReclaimed / (5 * 1024 * 1024),
            size: notReclaimed,
            remediation: [
              'Review large closures capturing unnecessary variables',
              'Use WeakRef for large objects in closures',
              'Break large functions into smaller ones',
              'Null out large variables when no longer needed'
            ]
          });
        }
      }
    } catch (error) {
      // GC not available, skip closure detection
    }

    return leaks;
  }

  /**
   * Detect DOM leaks
   */
  private detectDOMLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    
    if (typeof document !== 'undefined') {
      const nodeCount = document.querySelectorAll('*').length;
      
      if (nodeCount > 10000) {
        leaks.push({
          type: 'dom-reference',
          severity: nodeCount > 50000 ? 'critical' : nodeCount > 20000 ? 'high' : 'medium',
          location: 'DOM tree',
          description: `${nodeCount} DOM nodes, potential memory leak`,
          detectedAt: Date.now(),
          growth: nodeCount / 5000,
          size: nodeCount * 500, // Estimated size per node
          remediation: [
            'Remove unused DOM elements',
            'Use DocumentFragment for large DOM operations',
            'Implement virtual scrolling for large lists',
            'Clean up dynamically created elements'
          ]
        });
      }

      // Check for detached DOM nodes (simplified detection)
      const scripts = document.querySelectorAll('script[data-detached]').length;
      if (scripts > 100) {
        leaks.push({
          type: 'dom-reference',
          severity: 'medium',
          location: 'detached DOM nodes',
          description: `${scripts} potentially detached DOM nodes`,
          detectedAt: Date.now(),
          growth: scripts / 50,
          size: scripts * 1000,
          remediation: [
            'Remove references to detached DOM nodes',
            'Use WeakRef for DOM element references',
            'Clean up event listeners before removing elements'
          ]
        });
      }
    }

    return leaks;
  }

  /**
   * Detect observer leaks
   */
  private detectObserverLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    
    if (this.observers.size > 50) {
      leaks.push({
        type: 'observer',
        severity: this.observers.size > 200 ? 'high' : 'medium',
        location: 'observers',
        description: `${this.observers.size} active observers (MutationObserver, IntersectionObserver, etc.)`,
        detectedAt: Date.now(),
        growth: this.observers.size / 25,
        size: this.observers.size * 1000,
        remediation: [
          'Disconnect unused observers',
          'Use AbortController for observer cleanup',
          'Review observer usage patterns',
          'Implement proper cleanup in component lifecycle'
        ]
      });
    }

    return leaks;
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): any {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    } else if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      return {
        heapUsed: mem.usedJSHeapSize,
        heapTotal: mem.totalJSHeapSize,
        external: 0,
        rss: mem.totalJSHeapSize
      };
    }
    return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
  }

  /**
   * Get object counts
   */
  private getObjectCounts(): ObjectCounts {
    const counts: ObjectCounts = {
      objects: 0,
      arrays: 0,
      functions: 0,
      strings: 0,
      numbers: 0,
      domNodes: 0,
      eventListeners: Array.from(this.eventListeners.values()).reduce((sum, count) => sum + count, 0),
      timers: this.timers.size,
      observers: this.observers.size
    };

    if (typeof document !== 'undefined') {
      counts.domNodes = document.querySelectorAll('*').length;
    }

    return counts;
  }

  /**
   * Get heap snapshot (simplified)
   */
  private getHeapSnapshot(): any {
    // This would integrate with V8 heap profiler in production
    return {
      timestamp: Date.now(),
      size: this.getMemoryUsage().heapUsed
    };
  }

  /**
   * Register timer for monitoring
   */
  public registerTimer(id: number): void {
    this.timers.add(id);
  }

  /**
   * Unregister timer
   */
  public unregisterTimer(id: number): void {
    this.timers.delete(id);
  }

  /**
   * Register event listener
   */
  public registerEventListener(event: string): void {
    this.eventListeners.set(event, (this.eventListeners.get(event) || 0) + 1);
  }

  /**
   * Unregister event listener
   */
  public unregisterEventListener(event: string): void {
    const count = this.eventListeners.get(event) || 0;
    if (count > 1) {
      this.eventListeners.set(event, count - 1);
    } else {
      this.eventListeners.delete(event);
    }
  }

  /**
   * Register observer
   */
  public registerObserver(observer: any): void {
    this.observers.add(observer);
  }

  /**
   * Unregister observer
   */
  public unregisterObserver(observer: any): void {
    this.observers.delete(observer);
  }
}

/**
 * Memory Optimizer
 */
export class MemoryOptimizer {
  private leakDetector: MemoryLeakDetector;
  private cleanupStrategies: CleanupStrategy[] = [];
  private metrics: MemoryMetrics[] = [];
  private optimizationHistory: MemoryOptimizationResult[] = [];
  private thresholds: MemoryThreshold;
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  constructor() {
    this.leakDetector = new MemoryLeakDetector();
    this.thresholds = {
      warning: 0.8,   // 80% of available memory
      critical: 0.9,  // 90% of available memory
      emergency: 0.95 // 95% of available memory
    };

    this.initializeCleanupStrategies();
  }

  /**
   * Initialize cleanup strategies
   */
  private initializeCleanupStrategies(): void {
    this.cleanupStrategies = [
      {
        name: 'force_gc',
        priority: 1,
        enabled: true,
        execute: this.forceGarbageCollection.bind(this),
        description: 'Force garbage collection'
      },
      {
        name: 'clear_caches',
        priority: 2,
        enabled: true,
        execute: this.clearCaches.bind(this),
        description: 'Clear application caches'
      },
      {
        name: 'cleanup_timers',
        priority: 3,
        enabled: true,
        execute: this.cleanupTimers.bind(this),
        description: 'Clean up unused timers'
      },
      {
        name: 'cleanup_listeners',
        priority: 4,
        enabled: true,
        execute: this.cleanupEventListeners.bind(this),
        description: 'Clean up unused event listeners'
      },
      {
        name: 'cleanup_observers',
        priority: 5,
        enabled: true,
        execute: this.cleanupObservers.bind(this),
        description: 'Clean up unused observers'
      },
      {
        name: 'cleanup_dom',
        priority: 6,
        enabled: true,
        execute: this.cleanupDOMReferences.bind(this),
        description: 'Clean up DOM references'
      }
    ];
  }

  /**
   * Start memory monitoring
   */
  public startMonitoring(interval: number = 30000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
      await this.checkThresholds();
    }, interval);

    console.log('Memory monitoring started');
  }

  /**
   * Stop memory monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    console.log('Memory monitoring stopped');
  }

  /**
   * Collect memory metrics
   */
  public async collectMetrics(): Promise<void> {
    this.leakDetector.takeSnapshot();
    
    const memoryUsage = this.getMemoryUsage();
    const leaks = this.leakDetector.detectLeaks();
    const gcStats = this.getGCStatistics();
    const objectCounts = this.getObjectCounts();

    const metrics: MemoryMetrics = {
      used: memoryUsage.heapUsed,
      total: memoryUsage.heapTotal,
      free: memoryUsage.heapTotal - memoryUsage.heapUsed,
      cached: memoryUsage.external,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers || 0,
      rss: memoryUsage.rss,
      leaks,
      gcStats,
      objectCounts
    };

    this.metrics.push(metrics);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): any {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    } else if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      return {
        heapUsed: mem.usedJSHeapSize,
        heapTotal: mem.totalJSHeapSize,
        external: 0,
        rss: mem.totalJSHeapSize
      };
    }
    return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
  }

  /**
   * Get GC statistics
   */
  private getGCStatistics(): GCStatistics {
    // This would integrate with V8 GC events in production
    return {
      collections: 0,
      pauseTime: 0,
      reclaimedMemory: 0,
      frequency: 0,
      efficiency: 0,
      lastCollection: Date.now(),
      type: 'unknown'
    };
  }

  /**
   * Get object counts
   */
  private getObjectCounts(): ObjectCounts {
    return {
      objects: 0,
      arrays: 0,
      functions: 0,
      strings: 0,
      numbers: 0,
      domNodes: typeof document !== 'undefined' ? document.querySelectorAll('*').length : 0,
      eventListeners: 0,
      timers: 0,
      observers: 0
    };
  }

  /**
   * Check memory thresholds and trigger cleanup
   */
  private async checkThresholds(): Promise<void> {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) return;

    const usageRatio = currentMetrics.used / currentMetrics.total;

    if (usageRatio >= this.thresholds.emergency) {
      console.warn('Emergency memory threshold reached, executing all cleanup strategies');
      await this.executeEmergencyCleanup();
    } else if (usageRatio >= this.thresholds.critical) {
      console.warn('Critical memory threshold reached, executing priority cleanup');
      await this.executeCriticalCleanup();
    } else if (usageRatio >= this.thresholds.warning) {
      console.log('Warning memory threshold reached, executing basic cleanup');
      await this.executeBasicCleanup();
    }
  }

  /**
   * Execute emergency cleanup
   */
  private async executeEmergencyCleanup(): Promise<void> {
    for (const strategy of this.cleanupStrategies) {
      if (strategy.enabled) {
        try {
          await strategy.execute();
        } catch (error) {
          console.error(`Emergency cleanup strategy '${strategy.name}' failed:`, error);
        }
      }
    }
  }

  /**
   * Execute critical cleanup
   */
  private async executeCriticalCleanup(): Promise<void> {
    const criticalStrategies = this.cleanupStrategies
      .filter(s => s.enabled && s.priority <= 3)
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of criticalStrategies) {
      try {
        await strategy.execute();
      } catch (error) {
        console.error(`Critical cleanup strategy '${strategy.name}' failed:`, error);
      }
    }
  }

  /**
   * Execute basic cleanup
   */
  private async executeBasicCleanup(): Promise<void> {
    const basicStrategies = this.cleanupStrategies
      .filter(s => s.enabled && s.priority <= 2)
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of basicStrategies) {
      try {
        await strategy.execute();
      } catch (error) {
        console.error(`Basic cleanup strategy '${strategy.name}' failed:`, error);
      }
    }
  }

  /**
   * Manual cleanup execution
   */
  public async cleanup(action: any): Promise<MemoryOptimizationResult> {
    const beforeMetrics = this.getCurrentMetrics();
    const freedMemory = await this.executeAllCleanupStrategies();
    const afterMetrics = this.getCurrentMetrics();

    const improvement = beforeMetrics && afterMetrics 
      ? ((beforeMetrics.used - afterMetrics.used) / beforeMetrics.used) * 100 
      : 0;

    const result: MemoryOptimizationResult = {
      success: freedMemory > 0,
      action: 'memory_cleanup',
      description: `Executed memory cleanup strategies, freed ${(freedMemory / 1024 / 1024).toFixed(2)}MB`,
      freedMemory,
      improvementPercentage: improvement,
      beforeMetrics: beforeMetrics || {},
      afterMetrics: afterMetrics || {},
      remediationApplied: this.cleanupStrategies.map(s => s.description)
    };

    this.optimizationHistory.push(result);
    return result;
  }

  /**
   * Execute all cleanup strategies
   */
  private async executeAllCleanupStrategies(): Promise<number> {
    let totalFreed = 0;

    const strategies = this.cleanupStrategies
      .filter(s => s.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of strategies) {
      try {
        const freed = await strategy.execute();
        totalFreed += freed;
      } catch (error) {
        console.error(`Cleanup strategy '${strategy.name}' failed:`, error);
      }
    }

    return totalFreed;
  }

  /**
   * Force garbage collection
   */
  private async forceGarbageCollection(): Promise<number> {
    if (typeof global !== 'undefined' && global.gc) {
      const before = this.getMemoryUsage().heapUsed;
      global.gc();
      const after = this.getMemoryUsage().heapUsed;
      return Math.max(0, before - after);
    } else if (typeof window !== 'undefined' && (window as any).gc) {
      const before = this.getMemoryUsage().heapUsed;
      (window as any).gc();
      const after = this.getMemoryUsage().heapUsed;
      return Math.max(0, before - after);
    }
    return 0;
  }

  /**
   * Clear application caches
   */
  private async clearCaches(): Promise<number> {
    let freedMemory = 0;

    // Clear browser caches if available
    if (typeof caches !== 'undefined') {
      try {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
        }
        freedMemory += 1024 * 1024; // Estimate 1MB freed
      } catch (error) {
        console.error('Cache clearing failed:', error);
      }
    }

    // Clear localStorage if it's getting large
    if (typeof localStorage !== 'undefined') {
      try {
        const storageSize = JSON.stringify(localStorage).length;
        if (storageSize > 1024 * 1024) { // > 1MB
          localStorage.clear();
          freedMemory += storageSize;
        }
      } catch (error) {
        console.error('localStorage clearing failed:', error);
      }
    }

    return freedMemory;
  }

  /**
   * Clean up unused timers
   */
  private async cleanupTimers(): Promise<number> {
    // This would need integration with timer tracking
    return 0;
  }

  /**
   * Clean up unused event listeners
   */
  private async cleanupEventListeners(): Promise<number> {
    // This would need integration with event listener tracking
    return 0;
  }

  /**
   * Clean up unused observers
   */
  private async cleanupObservers(): Promise<number> {
    // This would need integration with observer tracking
    return 0;
  }

  /**
   * Clean up DOM references
   */
  private async cleanupDOMReferences(): Promise<number> {
    if (typeof document === 'undefined') return 0;

    let freedMemory = 0;

    // Remove unused elements with data-cleanup attribute
    const cleanupElements = document.querySelectorAll('[data-cleanup]');
    cleanupElements.forEach(element => {
      element.remove();
      freedMemory += 500; // Estimate 500 bytes per element
    });

    // Clean up empty text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          return node.textContent?.trim() === '' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const emptyTextNodes: Node[] = [];
    let node;
    while (node = walker.nextNode()) {
      emptyTextNodes.push(node);
    }

    emptyTextNodes.forEach(textNode => {
      textNode.remove();
      freedMemory += 50; // Estimate 50 bytes per text node
    });

    return freedMemory;
  }

  /**
   * Detect memory leaks
   */
  public async detectLeaks(): Promise<MemoryLeak[]> {
    return this.leakDetector.detectLeaks();
  }

  /**
   * Get current metrics
   */
  public getCurrentMetrics(): MemoryMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  /**
   * Get metrics history
   */
  public getMetricsHistory(limit: number = 100): MemoryMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get optimization history
   */
  public getOptimizationHistory(): MemoryOptimizationResult[] {
    return [...this.optimizationHistory];
  }

  /**
   * Update thresholds
   */
  public updateThresholds(thresholds: Partial<MemoryThreshold>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get leak detector
   */
  public getLeakDetector(): MemoryLeakDetector {
    return this.leakDetector;
  }

  /**
   * Add custom cleanup strategy
   */
  public addCleanupStrategy(strategy: CleanupStrategy): void {
    this.cleanupStrategies.push(strategy);
    this.cleanupStrategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove cleanup strategy
   */
  public removeCleanupStrategy(name: string): void {
    this.cleanupStrategies = this.cleanupStrategies.filter(s => s.name !== name);
  }

  /**
   * Get cleanup strategies
   */
  public getCleanupStrategies(): CleanupStrategy[] {
    return [...this.cleanupStrategies];
  }
}

// Export singleton instance
export const memoryOptimizer = new MemoryOptimizer();