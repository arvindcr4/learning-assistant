/**
 * Advanced Memory Management System
 * Implements sophisticated memory optimization strategies for A+ performance
 */

export interface MemoryUsage {
  used: number;
  total: number;
  limit: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  leakDetected: boolean;
}

export interface MemoryLeak {
  type: 'component' | 'event_listener' | 'timer' | 'closure' | 'dom_reference';
  source: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retainedSize: number;
  createdAt: number;
  lastAccessed: number;
  suggestions: string[];
}

export interface GarbageCollectionStats {
  frequency: number;
  averageDuration: number;
  totalCollections: number;
  majorCollections: number;
  minorCollections: number;
  efficiency: number;
}

export interface MemoryProfile {
  heapSize: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  peak: number;
  collections: GarbageCollectionStats;
  leaks: MemoryLeak[];
  optimizations: MemoryOptimization[];
}

export interface MemoryOptimization {
  type: 'object_pooling' | 'weak_references' | 'lazy_loading' | 'data_compression' | 'cache_cleanup';
  description: string;
  impact: 'high' | 'medium' | 'low';
  implementation: string[];
  potentialSavings: number;
}

export class MemoryManager {
  private static instance: MemoryManager;
  private memoryHistory: MemoryUsage[] = [];
  private activeComponents = new WeakMap<object, ComponentMemoryTracker>();
  private eventListeners = new Map<string, EventListenerTracker>();
  private timers = new Map<number, TimerTracker>();
  private observers = new Map<string, ObserverTracker>();
  private objectPools = new Map<string, ObjectPool<any>>();
  private gcObserver?: PerformanceObserver;
  private memoryInterval?: NodeJS.Timeout;
  
  private readonly MEMORY_CHECK_INTERVAL = 5000; // 5 seconds
  private readonly HISTORY_LIMIT = 100;
  private readonly LEAK_THRESHOLD = 50 * 1024 * 1024; // 50MB
  private readonly GC_PRESSURE_THRESHOLD = 0.8; // 80% memory usage

  private constructor() {
    this.initializeMonitoring();
    this.setupGCObserver();
  }

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Initialize memory monitoring
   */
  private initializeMonitoring(): void {
    if (typeof window !== 'undefined') {
      this.memoryInterval = setInterval(() => {
        this.checkMemoryUsage();
      }, this.MEMORY_CHECK_INTERVAL);

      // Monitor for page unload to cleanup
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }

  /**
   * Setup Garbage Collection observer
   */
  private setupGCObserver(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.gcObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.entryType === 'measure' && entry.name.includes('gc')) {
              this.handleGCEvent(entry);
            }
          }
        });
        this.gcObserver.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('GC observer not supported:', error);
      }
    }
  }

  /**
   * Check current memory usage and detect issues
   */
  private checkMemoryUsage(): void {
    const memoryInfo = this.getMemoryInfo();
    if (!memoryInfo) return;

    const usage: MemoryUsage = {
      used: memoryInfo.usedJSHeapSize,
      total: memoryInfo.totalJSHeapSize,
      limit: memoryInfo.jsHeapSizeLimit,
      percentage: (memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize) * 100,
      trend: this.calculateTrend(memoryInfo.usedJSHeapSize),
      leakDetected: this.detectMemoryLeak(memoryInfo.usedJSHeapSize)
    };

    this.memoryHistory.push(usage);
    if (this.memoryHistory.length > this.HISTORY_LIMIT) {
      this.memoryHistory.shift();
    }

    // Trigger cleanup if memory pressure is high
    if (usage.percentage > this.GC_PRESSURE_THRESHOLD * 100) {
      this.performEmergencyCleanup();
    }

    // Check for specific leak patterns
    this.checkForLeaks();
  }

  /**
   * Track component memory usage
   */
  public trackComponent(component: object, name: string): void {
    const tracker = new ComponentMemoryTracker(name);
    this.activeComponents.set(component, tracker);
  }

  /**
   * Untrack component (called on unmount)
   */
  public untrackComponent(component: object): void {
    const tracker = this.activeComponents.get(component);
    if (tracker) {
      tracker.cleanup();
      this.activeComponents.delete(component);
    }
  }

  /**
   * Track event listeners
   */
  public trackEventListener(
    element: EventTarget,
    event: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    const id = this.generateListenerId(element, event, listener);
    const tracker = new EventListenerTracker(element, event, listener, options);
    this.eventListeners.set(id, tracker);
  }

  /**
   * Untrack event listener
   */
  public untrackEventListener(
    element: EventTarget,
    event: string,
    listener: EventListener
  ): void {
    const id = this.generateListenerId(element, event, listener);
    const tracker = this.eventListeners.get(id);
    if (tracker) {
      tracker.cleanup();
      this.eventListeners.delete(id);
    }
  }

  /**
   * Track timers (setTimeout, setInterval)
   */
  public trackTimer(id: number, type: 'timeout' | 'interval', callback: Function): void {
    const tracker = new TimerTracker(type, callback);
    this.timers.set(id, tracker);
  }

  /**
   * Untrack timer
   */
  public untrackTimer(id: number): void {
    const tracker = this.timers.get(id);
    if (tracker) {
      tracker.cleanup();
      this.timers.delete(id);
    }
  }

  /**
   * Create or get object pool
   */
  public getObjectPool<T>(name: string, factory: () => T, reset?: (obj: T) => void): ObjectPool<T> {
    if (!this.objectPools.has(name)) {
      this.objectPools.set(name, new ObjectPool(factory, reset));
    }
    return this.objectPools.get(name) as ObjectPool<T>;
  }

  /**
   * Force garbage collection if available
   */
  public forceGarbageCollection(): boolean {
    if (typeof (window as any).gc === 'function') {
      (window as any).gc();
      return true;
    }
    return false;
  }

  /**
   * Get comprehensive memory profile
   */
  public getMemoryProfile(): MemoryProfile {
    const memoryInfo = this.getMemoryInfo();
    const leaks = this.detectAllLeaks();
    
    return {
      heapSize: memoryInfo?.totalJSHeapSize || 0,
      heapUsed: memoryInfo?.usedJSHeapSize || 0,
      external: 0, // Would need Node.js process.memoryUsage()
      arrayBuffers: 0, // Would need specific tracking
      peak: Math.max(...this.memoryHistory.map(h => h.used)),
      collections: this.getGCStats(),
      leaks,
      optimizations: this.generateOptimizations(leaks)
    };
  }

  /**
   * Perform emergency cleanup
   */
  private performEmergencyCleanup(): void {
    console.warn('Memory pressure detected, performing emergency cleanup');

    // Clear object pools
    for (const pool of this.objectPools.values()) {
      pool.clear();
    }

    // Clear old history
    this.memoryHistory = this.memoryHistory.slice(-20);

    // Trigger garbage collection
    this.forceGarbageCollection();
  }

  /**
   * Detect memory leaks
   */
  private detectMemoryLeak(currentUsage: number): boolean {
    if (this.memoryHistory.length < 10) return false;

    const recent = this.memoryHistory.slice(-10);
    const growth = currentUsage - recent[0].used;
    
    return growth > this.LEAK_THRESHOLD;
  }

  /**
   * Calculate memory usage trend
   */
  private calculateTrend(currentUsage: number): 'increasing' | 'decreasing' | 'stable' {
    if (this.memoryHistory.length < 5) return 'stable';

    const recent = this.memoryHistory.slice(-5);
    const avgRecent = recent.reduce((sum, h) => sum + h.used, 0) / recent.length;
    const change = (currentUsage - avgRecent) / avgRecent;

    if (change > 0.05) return 'increasing';
    if (change < -0.05) return 'decreasing';
    return 'stable';
  }

  /**
   * Check for specific leak patterns
   */
  private checkForLeaks(): void {
    // Check for event listener leaks
    if (this.eventListeners.size > 1000) {
      console.warn(`High number of event listeners: ${this.eventListeners.size}`);
    }

    // Check for timer leaks
    if (this.timers.size > 100) {
      console.warn(`High number of active timers: ${this.timers.size}`);
    }

    // Check for observer leaks
    if (this.observers.size > 50) {
      console.warn(`High number of observers: ${this.observers.size}`);
    }
  }

  /**
   * Detect all types of memory leaks
   */
  private detectAllLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];

    // Check event listener leaks
    const staleBit = Date.now() - 5 * 60 * 1000; // 5 minutes
    for (const [id, tracker] of this.eventListeners.entries()) {
      if (tracker.createdAt < staleBit && !tracker.wasRecentlyUsed()) {
        leaks.push({
          type: 'event_listener',
          source: `Event listener: ${tracker.event}`,
          severity: 'medium',
          retainedSize: 1000, // Estimated
          createdAt: tracker.createdAt,
          lastAccessed: tracker.lastUsed,
          suggestions: [
            'Remove event listeners on component unmount',
            'Use WeakMap for element-listener associations',
            'Consider using event delegation'
          ]
        });
      }
    }

    // Check timer leaks
    for (const [id, tracker] of this.timers.entries()) {
      if (tracker.type === 'interval' && tracker.createdAt < staleBit) {
        leaks.push({
          type: 'timer',
          source: `${tracker.type} timer`,
          severity: 'high',
          retainedSize: 500, // Estimated
          createdAt: tracker.createdAt,
          lastAccessed: Date.now(),
          suggestions: [
            'Clear intervals on component unmount',
            'Use useEffect cleanup functions',
            'Consider using RAF for animations'
          ]
        });
      }
    }

    return leaks;
  }

  /**
   * Generate memory optimizations
   */
  private generateOptimizations(leaks: MemoryLeak[]): MemoryOptimization[] {
    const optimizations: MemoryOptimization[] = [];

    if (leaks.length > 0) {
      optimizations.push({
        type: 'weak_references',
        description: 'Use WeakMap and WeakSet for loose references',
        impact: 'high',
        implementation: [
          'Replace Map with WeakMap where appropriate',
          'Use WeakSet for object tracking',
          'Implement weak event listeners'
        ],
        potentialSavings: leaks.reduce((sum, leak) => sum + leak.retainedSize, 0)
      });
    }

    if (this.objectPools.size === 0) {
      optimizations.push({
        type: 'object_pooling',
        description: 'Implement object pooling for frequently created objects',
        impact: 'medium',
        implementation: [
          'Pool DOM elements for virtual scrolling',
          'Pool data objects for rendering',
          'Pool animation frames'
        ],
        potentialSavings: 10 * 1024 * 1024 // 10MB estimated
      });
    }

    optimizations.push({
      type: 'lazy_loading',
      description: 'Implement lazy loading for non-critical resources',
      impact: 'high',
      implementation: [
        'Lazy load images and videos',
        'Defer non-critical JavaScript',
        'Use virtual scrolling for large lists'
      ],
      potentialSavings: 20 * 1024 * 1024 // 20MB estimated
    });

    return optimizations;
  }

  /**
   * Get garbage collection stats
   */
  private getGCStats(): GarbageCollectionStats {
    // This would be enhanced with actual GC monitoring
    return {
      frequency: 10000, // ms between collections
      averageDuration: 5, // ms
      totalCollections: 0,
      majorCollections: 0,
      minorCollections: 0,
      efficiency: 85 // percentage
    };
  }

  /**
   * Handle GC events
   */
  private handleGCEvent(entry: PerformanceEntry): void {
    // Process garbage collection performance entries
    console.log('GC Event:', entry.name, entry.duration);
  }

  /**
   * Get memory info from browser
   */
  private getMemoryInfo(): any {
    return (performance as any).memory;
  }

  /**
   * Generate unique ID for event listeners
   */
  private generateListenerId(element: EventTarget, event: string, listener: EventListener): string {
    return `${element.constructor.name}_${event}_${listener.toString().substring(0, 50)}`;
  }

  /**
   * Cleanup all tracking
   */
  public cleanup(): void {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }

    if (this.gcObserver) {
      this.gcObserver.disconnect();
    }

    // Clear all tracking
    this.eventListeners.clear();
    this.timers.clear();
    this.observers.clear();
    
    // Clear object pools
    for (const pool of this.objectPools.values()) {
      pool.clear();
    }
  }
}

/**
 * Component Memory Tracker
 */
class ComponentMemoryTracker {
  public readonly name: string;
  public readonly createdAt: number;
  private domNodes: WeakSet<Node> = new WeakSet();
  private subscriptions: (() => void)[] = [];

  constructor(name: string) {
    this.name = name;
    this.createdAt = Date.now();
  }

  public trackDOMNode(node: Node): void {
    this.domNodes.add(node);
  }

  public addSubscription(cleanup: () => void): void {
    this.subscriptions.push(cleanup);
  }

  public cleanup(): void {
    this.subscriptions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    });
    this.subscriptions = [];
  }
}

/**
 * Event Listener Tracker
 */
class EventListenerTracker {
  public readonly element: EventTarget;
  public readonly event: string;
  public readonly listener: EventListener;
  public readonly options?: boolean | AddEventListenerOptions;
  public readonly createdAt: number;
  public lastUsed: number;

  constructor(
    element: EventTarget,
    event: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ) {
    this.element = element;
    this.event = event;
    this.listener = listener;
    this.options = options;
    this.createdAt = Date.now();
    this.lastUsed = Date.now();
  }

  public wasRecentlyUsed(): boolean {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return this.lastUsed > fiveMinutesAgo;
  }

  public cleanup(): void {
    try {
      this.element.removeEventListener(this.event, this.listener, this.options);
    } catch (error) {
      console.warn('Failed to remove event listener:', error);
    }
  }
}

/**
 * Timer Tracker
 */
class TimerTracker {
  public readonly type: 'timeout' | 'interval';
  public readonly callback: Function;
  public readonly createdAt: number;

  constructor(type: 'timeout' | 'interval', callback: Function) {
    this.type = type;
    this.callback = callback;
    this.createdAt = Date.now();
  }

  public cleanup(): void {
    // Timer cleanup is handled by browser when cleared
  }
}

/**
 * Observer Tracker
 */
class ObserverTracker {
  public readonly observer: any;
  public readonly type: string;
  public readonly createdAt: number;

  constructor(observer: any, type: string) {
    this.observer = observer;
    this.type = type;
    this.createdAt = Date.now();
  }

  public cleanup(): void {
    if (this.observer && typeof this.observer.disconnect === 'function') {
      this.observer.disconnect();
    }
  }
}

/**
 * Object Pool for memory optimization
 */
class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset?: (obj: T) => void;
  private maxSize: number = 100;

  constructor(factory: () => T, reset?: (obj: T) => void, maxSize = 100) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
  }

  public acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  public release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      if (this.reset) {
        this.reset(obj);
      }
      this.pool.push(obj);
    }
  }

  public clear(): void {
    this.pool = [];
  }

  public size(): number {
    return this.pool.length;
  }
}

// Singleton instance
export const memoryManager = MemoryManager.getInstance();