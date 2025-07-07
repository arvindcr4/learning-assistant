'use client';

import { useEffect, useRef, useCallback } from 'react';

// Memory leak prevention utilities
export interface CleanupFunction {
  (): void;
}

export interface TimerCleanup {
  clear: () => void;
  id: number | NodeJS.Timeout;
  type: 'timeout' | 'interval';
}

export interface ListenerCleanup {
  remove: () => void;
  element: EventTarget;
  event: string;
  handler: EventListener;
}

export interface ObserverCleanup {
  disconnect: () => void;
  observer: IntersectionObserver | MutationObserver | ResizeObserver | PerformanceObserver;
  type: string;
}

// Memory leak tracker
class MemoryLeakTracker {
  private static instance: MemoryLeakTracker;
  private cleanupRegistry: Map<string, CleanupFunction[]>;
  private componentTimers: Map<string, TimerCleanup[]>;
  private componentListeners: Map<string, ListenerCleanup[]>;
  private componentObservers: Map<string, ObserverCleanup[]>;
  private leakWarnings: Map<string, number>;

  private constructor() {
    this.cleanupRegistry = new Map();
    this.componentTimers = new Map();
    this.componentListeners = new Map();
    this.componentObservers = new Map();
    this.leakWarnings = new Map();
  }

  static getInstance(): MemoryLeakTracker {
    if (!MemoryLeakTracker.instance) {
      MemoryLeakTracker.instance = new MemoryLeakTracker();
    }
    return MemoryLeakTracker.instance;
  }

  registerComponent(componentId: string): void {
    if (!this.cleanupRegistry.has(componentId)) {
      this.cleanupRegistry.set(componentId, []);
      this.componentTimers.set(componentId, []);
      this.componentListeners.set(componentId, []);
      this.componentObservers.set(componentId, []);
    }
  }

  addCleanup(componentId: string, cleanup: CleanupFunction): void {
    const cleanups = this.cleanupRegistry.get(componentId) || [];
    cleanups.push(cleanup);
    this.cleanupRegistry.set(componentId, cleanups);
  }

  addTimer(componentId: string, timer: TimerCleanup): void {
    const timers = this.componentTimers.get(componentId) || [];
    timers.push(timer);
    this.componentTimers.set(componentId, timers);
  }

  addListener(componentId: string, listener: ListenerCleanup): void {
    const listeners = this.componentListeners.get(componentId) || [];
    listeners.push(listener);
    this.componentListeners.set(componentId, listeners);
  }

  addObserver(componentId: string, observer: ObserverCleanup): void {
    const observers = this.componentObservers.get(componentId) || [];
    observers.push(observer);
    this.componentObservers.set(componentId, observers);
  }

  cleanupComponent(componentId: string): void {
    // Clean up timers
    const timers = this.componentTimers.get(componentId) || [];
    timers.forEach(timer => {
      try {
        timer.clear();
      } catch (error) {
        console.warn(`Failed to clear ${timer.type}:`, error);
      }
    });

    // Clean up event listeners
    const listeners = this.componentListeners.get(componentId) || [];
    listeners.forEach(listener => {
      try {
        listener.remove();
      } catch (error) {
        console.warn(`Failed to remove event listener:`, error);
      }
    });

    // Clean up observers
    const observers = this.componentObservers.get(componentId) || [];
    observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn(`Failed to disconnect ${observer.type} observer:`, error);
      }
    });

    // Clean up custom cleanup functions
    const cleanups = this.cleanupRegistry.get(componentId) || [];
    cleanups.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn(`Failed to execute cleanup function:`, error);
      }
    });

    // Remove from registry
    this.cleanupRegistry.delete(componentId);
    this.componentTimers.delete(componentId);
    this.componentListeners.delete(componentId);
    this.componentObservers.delete(componentId);
  }

  checkForLeaks(): void {
    const activeComponents = this.cleanupRegistry.size;
    const totalTimers = Array.from(this.componentTimers.values()).reduce((sum, timers) => sum + timers.length, 0);
    const totalListeners = Array.from(this.componentListeners.values()).reduce((sum, listeners) => sum + listeners.length, 0);
    const totalObservers = Array.from(this.componentObservers.values()).reduce((sum, observers) => sum + observers.length, 0);

    if (activeComponents > 100) {
      console.warn(`Potential memory leak: ${activeComponents} active components`);
    }
    if (totalTimers > 50) {
      console.warn(`Potential memory leak: ${totalTimers} active timers`);
    }
    if (totalListeners > 200) {
      console.warn(`Potential memory leak: ${totalListeners} active event listeners`);
    }
    if (totalObservers > 20) {
      console.warn(`Potential memory leak: ${totalObservers} active observers`);
    }
  }

  getStats(): {
    activeComponents: number;
    totalTimers: number;
    totalListeners: number;
    totalObservers: number;
    totalCleanups: number;
  } {
    return {
      activeComponents: this.cleanupRegistry.size,
      totalTimers: Array.from(this.componentTimers.values()).reduce((sum, timers) => sum + timers.length, 0),
      totalListeners: Array.from(this.componentListeners.values()).reduce((sum, listeners) => sum + listeners.length, 0),
      totalObservers: Array.from(this.componentObservers.values()).reduce((sum, observers) => sum + observers.length, 0),
      totalCleanups: Array.from(this.cleanupRegistry.values()).reduce((sum, cleanups) => sum + cleanups.length, 0),
    };
  }
}

// Main hook for memory leak prevention
export function useMemoryLeakPrevention(componentName?: string): {
  addCleanup: (cleanup: CleanupFunction) => void;
  safeSetTimeout: (callback: () => void, delay: number) => number;
  safeSetInterval: (callback: () => void, delay: number) => number;
  safeAddEventListener: <K extends keyof WindowEventMap>(
    target: EventTarget,
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ) => void;
  safeIntersectionObserver: (
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) => IntersectionObserver;
  safeMutationObserver: (callback: MutationCallback) => MutationObserver;
  safeResizeObserver: (callback: ResizeObserverCallback) => ResizeObserver;
  getStats: () => any;
} {
  const tracker = MemoryLeakTracker.getInstance();
  const componentId = useRef(
    componentName || `component-${Math.random().toString(36).substr(2, 9)}`
  ).current;

  // Register component on mount
  useEffect(() => {
    tracker.registerComponent(componentId);
    
    return () => {
      tracker.cleanupComponent(componentId);
    };
  }, [tracker, componentId]);

  const addCleanup = useCallback((cleanup: CleanupFunction) => {
    tracker.addCleanup(componentId, cleanup);
  }, [tracker, componentId]);

  const safeSetTimeout = useCallback((callback: () => void, delay: number): number => {
    const timeoutId = window.setTimeout(callback, delay);
    
    const timerCleanup: TimerCleanup = {
      clear: () => clearTimeout(timeoutId),
      id: timeoutId,
      type: 'timeout',
    };
    
    tracker.addTimer(componentId, timerCleanup);
    return timeoutId;
  }, [tracker, componentId]);

  const safeSetInterval = useCallback((callback: () => void, delay: number): number => {
    const intervalId = window.setInterval(callback, delay);
    
    const timerCleanup: TimerCleanup = {
      clear: () => clearInterval(intervalId),
      id: intervalId,
      type: 'interval',
    };
    
    tracker.addTimer(componentId, timerCleanup);
    return intervalId;
  }, [tracker, componentId]);

  const safeAddEventListener = useCallback(<K extends keyof WindowEventMap>(
    target: EventTarget,
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ) => {
    target.addEventListener(type, listener as EventListener, options);
    
    const listenerCleanup: ListenerCleanup = {
      remove: () => target.removeEventListener(type, listener as EventListener, options),
      element: target,
      event: type as string,
      handler: listener as EventListener,
    };
    
    tracker.addListener(componentId, listenerCleanup);
  }, [tracker, componentId]);

  const safeIntersectionObserver = useCallback((
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ): IntersectionObserver => {
    const observer = new IntersectionObserver(callback, options);
    
    const observerCleanup: ObserverCleanup = {
      disconnect: () => observer.disconnect(),
      observer,
      type: 'IntersectionObserver',
    };
    
    tracker.addObserver(componentId, observerCleanup);
    return observer;
  }, [tracker, componentId]);

  const safeMutationObserver = useCallback((callback: MutationCallback): MutationObserver => {
    const observer = new MutationObserver(callback);
    
    const observerCleanup: ObserverCleanup = {
      disconnect: () => observer.disconnect(),
      observer,
      type: 'MutationObserver',
    };
    
    tracker.addObserver(componentId, observerCleanup);
    return observer;
  }, [tracker, componentId]);

  const safeResizeObserver = useCallback((callback: ResizeObserverCallback): ResizeObserver => {
    const observer = new ResizeObserver(callback);
    
    const observerCleanup: ObserverCleanup = {
      disconnect: () => observer.disconnect(),
      observer,
      type: 'ResizeObserver',
    };
    
    tracker.addObserver(componentId, observerCleanup);
    return observer;
  }, [tracker, componentId]);

  const getStats = useCallback(() => tracker.getStats(), [tracker]);

  return {
    addCleanup,
    safeSetTimeout,
    safeSetInterval,
    safeAddEventListener,
    safeIntersectionObserver,
    safeMutationObserver,
    safeResizeObserver,
    getStats,
  };
}

// Hook for automatic timer cleanup
export function useSafeTimeout(
  callback: () => void,
  delay: number | null,
  dependencies: React.DependencyList = []
): void {
  const { safeSetTimeout } = useMemoryLeakPrevention();
  const savedCallback = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the timeout
  useEffect(() => {
    if (delay !== null) {
      const timeoutId = safeSetTimeout(() => savedCallback.current(), delay);
      return () => clearTimeout(timeoutId);
    }
  }, [delay, safeSetTimeout, ...dependencies]);
}

// Hook for automatic interval cleanup
export function useSafeInterval(
  callback: () => void,
  delay: number | null,
  dependencies: React.DependencyList = []
): void {
  const { safeSetInterval } = useMemoryLeakPrevention();
  const savedCallback = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delay !== null) {
      const intervalId = safeSetInterval(() => savedCallback.current(), delay);
      return () => clearInterval(intervalId);
    }
  }, [delay, safeSetInterval, ...dependencies]);
}

// Hook for automatic event listener cleanup
export function useSafeEventListener<K extends keyof WindowEventMap>(
  target: EventTarget | null,
  type: K,
  listener: (this: Window, ev: WindowEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions
): void {
  const { safeAddEventListener } = useMemoryLeakPrevention();

  useEffect(() => {
    if (target) {
      safeAddEventListener(target, type, listener, options);
    }
  }, [target, type, listener, options, safeAddEventListener]);
}

// Hook for automatic intersection observer cleanup
export function useSafeIntersectionObserver(
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
): IntersectionObserver | null {
  const { safeIntersectionObserver } = useMemoryLeakPrevention();
  const [observer, setObserver] = React.useState<IntersectionObserver | null>(null);

  useEffect(() => {
    const obs = safeIntersectionObserver(callback, options);
    setObserver(obs);
    
    return () => {
      obs.disconnect();
      setObserver(null);
    };
  }, [callback, options, safeIntersectionObserver]);

  return observer;
}

// Hook for memory pressure monitoring
export function useMemoryPressureMonitoring(): {
  memoryPressure: 'low' | 'medium' | 'high';
  usage: number;
  suggestions: string[];
} {
  const [memoryInfo, setMemoryInfo] = React.useState({
    memoryPressure: 'low' as 'low' | 'medium' | 'high',
    usage: 0,
    suggestions: [] as string[],
  });

  const { safeSetInterval } = useMemoryLeakPrevention();

  useEffect(() => {
    const checkMemoryPressure = () => {
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        const usageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
        
        let pressure: 'low' | 'medium' | 'high' = 'low';
        const suggestions: string[] = [];
        
        if (usageRatio > 0.9) {
          pressure = 'high';
          suggestions.push('Critical memory usage - consider refreshing the page');
          suggestions.push('Close unnecessary browser tabs');
          suggestions.push('Reduce data cached in memory');
        } else if (usageRatio > 0.7) {
          pressure = 'medium';
          suggestions.push('Moderate memory usage detected');
          suggestions.push('Consider clearing cached data');
        }
        
        setMemoryInfo({
          memoryPressure: pressure,
          usage: usageRatio,
          suggestions,
        });
      }
    };

    checkMemoryPressure();
    const intervalId = safeSetInterval(checkMemoryPressure, 5000);
    
    return () => clearInterval(intervalId);
  }, [safeSetInterval]);

  return memoryInfo;
}

// Global memory leak monitoring
if (typeof window !== 'undefined') {
  const tracker = MemoryLeakTracker.getInstance();
  
  // Check for leaks every 30 seconds
  setInterval(() => {
    tracker.checkForLeaks();
  }, 30000);
  
  // Add to window for debugging
  (window as any).__MEMORY_TRACKER__ = {
    getStats: () => tracker.getStats(),
    checkLeaks: () => tracker.checkForLeaks(),
  };
}

// Export tracker for advanced usage
export { MemoryLeakTracker };