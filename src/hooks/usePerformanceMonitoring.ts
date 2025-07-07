'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Performance metric types
export interface RenderMetric {
  componentName: string;
  renderTime: number;
  renderCount: number;
  timestamp: number;
  props?: Record<string, any>;
}

export interface MemoryMetric {
  used: number;
  total: number;
  limit: number;
  timestamp: number;
}

export interface InteractionMetric {
  type: string;
  target: string;
  duration: number;
  timestamp: number;
}

export interface StateUpdateMetric {
  contextName: string;
  action: string;
  duration: number;
  timestamp: number;
  payloadSize: number;
}

export interface PerformanceReport {
  renders: RenderMetric[];
  memory: MemoryMetric[];
  interactions: InteractionMetric[];
  stateUpdates: StateUpdateMetric[];
  longTasks: number[];
  cumulativeLayoutShift: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  timeToInteractive: number;
}

// Performance monitoring class
class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceReport;
  private observers: Map<string, PerformanceObserver>;
  private isMonitoring: boolean;
  private memoryInterval: NodeJS.Timeout | null = null;
  private longTaskThreshold = 50; // ms

  private constructor() {
    this.metrics = {
      renders: [],
      memory: [],
      interactions: [],
      stateUpdates: [],
      longTasks: [],
      cumulativeLayoutShift: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      firstInputDelay: 0,
      timeToInteractive: 0,
    };
    this.observers = new Map();
    this.isMonitoring = false;
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.setupObservers();
    this.startMemoryMonitoring();
    this.collectWebVitals();
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
  }

  private setupObservers(): void {
    // Long tasks observer
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > this.longTaskThreshold) {
              this.metrics.longTasks.push(entry.duration);
            }
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', longTaskObserver);
      } catch (error) {
        console.warn('Long task observer not supported');
      }

      // Layout shift observer
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry: any) => {
            if (entry.hadRecentInput) return;
            this.metrics.cumulativeLayoutShift += entry.value;
          });
        });
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('layout-shift', layoutShiftObserver);
      } catch (error) {
        console.warn('Layout shift observer not supported');
      }

      // First input delay observer
      try {
        const fidObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.metrics.firstInputDelay = entry.processingStart - entry.startTime;
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.set('first-input', fidObserver);
      } catch (error) {
        console.warn('First input delay observer not supported');
      }
    }
  }

  private startMemoryMonitoring(): void {
    if ('memory' in performance) {
      this.memoryInterval = setInterval(() => {
        const memInfo = (performance as any).memory;
        this.metrics.memory.push({
          used: memInfo.usedJSHeapSize,
          total: memInfo.totalJSHeapSize,
          limit: memInfo.jsHeapSizeLimit,
          timestamp: Date.now(),
        });

        // Keep only last 100 memory readings
        if (this.metrics.memory.length > 100) {
          this.metrics.memory = this.metrics.memory.slice(-100);
        }
      }, 1000);
    }
  }

  private collectWebVitals(): void {
    // Collect paint metrics
    if ('getEntriesByType' in performance) {
      const paintEntries = performance.getEntriesByType('paint');
      paintEntries.forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          this.metrics.firstContentfulPaint = entry.startTime;
        }
      });

      // Collect LCP
      if ('PerformanceObserver' in window) {
        try {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            this.metrics.largestContentfulPaint = lastEntry.startTime;
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
          this.observers.set('largest-contentful-paint', lcpObserver);
        } catch (error) {
          console.warn('LCP observer not supported');
        }
      }
    }
  }

  recordRender(componentName: string, renderTime: number, props?: Record<string, any>): void {
    const existingMetric = this.metrics.renders.find(m => m.componentName === componentName);
    
    if (existingMetric) {
      existingMetric.renderTime = renderTime;
      existingMetric.renderCount++;
      existingMetric.timestamp = Date.now();
      existingMetric.props = props;
    } else {
      this.metrics.renders.push({
        componentName,
        renderTime,
        renderCount: 1,
        timestamp: Date.now(),
        props,
      });
    }

    // Keep only last 1000 render metrics
    if (this.metrics.renders.length > 1000) {
      this.metrics.renders = this.metrics.renders.slice(-1000);
    }
  }

  recordInteraction(type: string, target: string, duration: number): void {
    this.metrics.interactions.push({
      type,
      target,
      duration,
      timestamp: Date.now(),
    });

    // Keep only last 500 interactions
    if (this.metrics.interactions.length > 500) {
      this.metrics.interactions = this.metrics.interactions.slice(-500);
    }
  }

  recordStateUpdate(contextName: string, action: string, duration: number, payloadSize: number): void {
    this.metrics.stateUpdates.push({
      contextName,
      action,
      duration,
      timestamp: Date.now(),
      payloadSize,
    });

    // Keep only last 500 state updates
    if (this.metrics.stateUpdates.length > 500) {
      this.metrics.stateUpdates = this.metrics.stateUpdates.slice(-500);
    }
  }

  getMetrics(): PerformanceReport {
    return { ...this.metrics };
  }

  clearMetrics(): void {
    this.metrics = {
      renders: [],
      memory: [],
      interactions: [],
      stateUpdates: [],
      longTasks: [],
      cumulativeLayoutShift: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      firstInputDelay: 0,
      timeToInteractive: 0,
    };
  }

  exportMetrics(): void {
    const report = this.generateReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private generateReport(): PerformanceReport & { analysis: any } {
    const metrics = this.getMetrics();
    
    return {
      ...metrics,
      analysis: {
        avgRenderTime: this.calculateAverage(metrics.renders.map(r => r.renderTime)),
        slowestComponents: metrics.renders
          .sort((a, b) => b.renderTime - a.renderTime)
          .slice(0, 10),
        memoryTrend: this.calculateMemoryTrend(metrics.memory),
        interactionLatency: this.calculateAverage(metrics.interactions.map(i => i.duration)),
        stateUpdateLatency: this.calculateAverage(metrics.stateUpdates.map(s => s.duration)),
        longTaskFrequency: metrics.longTasks.length,
        performanceScore: this.calculatePerformanceScore(metrics),
      },
    };
  }

  private calculateAverage(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private calculateMemoryTrend(memory: MemoryMetric[]): 'increasing' | 'decreasing' | 'stable' {
    if (memory.length < 2) return 'stable';
    
    const recent = memory.slice(-10);
    const first = recent[0].used;
    const last = recent[recent.length - 1].used;
    
    const diff = (last - first) / first;
    
    if (diff > 0.1) return 'increasing';
    if (diff < -0.1) return 'decreasing';
    return 'stable';
  }

  private calculatePerformanceScore(metrics: PerformanceReport): number {
    let score = 100;
    
    // Deduct points for poor metrics
    if (metrics.firstContentfulPaint > 2000) score -= 20;
    if (metrics.largestContentfulPaint > 4000) score -= 20;
    if (metrics.firstInputDelay > 100) score -= 15;
    if (metrics.cumulativeLayoutShift > 0.1) score -= 15;
    if (metrics.longTasks.length > 5) score -= 10;
    
    const avgRenderTime = this.calculateAverage(metrics.renders.map(r => r.renderTime));
    if (avgRenderTime > 16) score -= 10;
    
    return Math.max(0, score);
  }
}

// React hooks for performance monitoring
export function usePerformanceMonitoring(): {
  startMonitoring: () => void;
  stopMonitoring: () => void;
  getMetrics: () => PerformanceReport;
  clearMetrics: () => void;
  exportMetrics: () => void;
} {
  const monitor = PerformanceMonitor.getInstance();
  
  return {
    startMonitoring: () => monitor.startMonitoring(),
    stopMonitoring: () => monitor.stopMonitoring(),
    getMetrics: () => monitor.getMetrics(),
    clearMetrics: () => monitor.clearMetrics(),
    exportMetrics: () => monitor.exportMetrics(),
  };
}

export function useRenderTracking(componentName: string, props?: Record<string, any>): void {
  const monitor = PerformanceMonitor.getInstance();
  const renderStartTime = useRef<number>(0);
  
  // Track render start
  renderStartTime.current = performance.now();
  
  // Track render end
  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    monitor.recordRender(componentName, renderTime, props);
  });
}

export function useInteractionTracking(): {
  trackInteraction: (type: string, target: string, startTime: number) => void;
} {
  const monitor = PerformanceMonitor.getInstance();
  
  const trackInteraction = useCallback((type: string, target: string, startTime: number) => {
    const duration = performance.now() - startTime;
    monitor.recordInteraction(type, target, duration);
  }, [monitor]);
  
  return { trackInteraction };
}

export function useStateUpdateTracking(contextName: string): {
  trackStateUpdate: (action: string, payloadSize: number, startTime: number) => void;
} {
  const monitor = PerformanceMonitor.getInstance();
  
  const trackStateUpdate = useCallback((action: string, payloadSize: number, startTime: number) => {
    const duration = performance.now() - startTime;
    monitor.recordStateUpdate(contextName, action, duration, payloadSize);
  }, [monitor, contextName]);
  
  return { trackStateUpdate };
}

export function useMemoryLeakDetection(): {
  isLeaking: boolean;
  memoryUsage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
} {
  const [isLeaking, setIsLeaking] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [trend, setTrend] = useState<'increasing' | 'decreasing' | 'stable'>('stable');
  
  useEffect(() => {
    const monitor = PerformanceMonitor.getInstance();
    
    const checkMemoryLeak = () => {
      const metrics = monitor.getMetrics();
      const recentMemory = metrics.memory.slice(-10);
      
      if (recentMemory.length > 0) {
        const latest = recentMemory[recentMemory.length - 1];
        setMemoryUsage(latest.used);
        
        if (recentMemory.length >= 10) {
          const first = recentMemory[0];
          const growthRate = (latest.used - first.used) / first.used;
          
          if (growthRate > 0.2) {
            setTrend('increasing');
            setIsLeaking(growthRate > 0.5);
          } else if (growthRate < -0.2) {
            setTrend('decreasing');
            setIsLeaking(false);
          } else {
            setTrend('stable');
            setIsLeaking(false);
          }
        }
      }
    };
    
    const interval = setInterval(checkMemoryLeak, 5000);
    return () => clearInterval(interval);
  }, []);
  
  return { isLeaking, memoryUsage, trend };
}

