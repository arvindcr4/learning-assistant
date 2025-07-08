import * as Sentry from '@sentry/nextjs';
import { capturePerformanceError, startSentryTransaction, startSentrySpan } from './sentry-utils';

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals
  LCP: 2500, // Largest Contentful Paint (ms)
  FID: 100,  // First Input Delay (ms)
  CLS: 0.1,  // Cumulative Layout Shift
  
  // Custom metrics
  API_RESPONSE: 1000,    // API response time (ms)
  COMPONENT_RENDER: 16,  // Component render time (ms) - 60fps target
  LEARNING_SESSION_LOAD: 2000, // Learning session load time (ms)
  QUIZ_RESPONSE: 200,    // Quiz response time (ms)
  
  // Memory thresholds
  MEMORY_USAGE: 50 * 1024 * 1024, // 50MB
  MEMORY_LEAK_THRESHOLD: 100 * 1024 * 1024, // 100MB
} as const;

// Performance metrics interface
export interface PerformanceMetric {
  name: string;
  value: number;
  threshold: number;
  timestamp: number;
  url: string;
  userId?: string;
  sessionId?: string;
  context?: Record<string, any>;
}

// Performance monitoring class
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];
  private memoryCheckInterval?: NodeJS.Timeout;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers();
      this.startMemoryMonitoring();
    }
  }

  private initializeObservers() {
    // Core Web Vitals observer
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        this.recordMetric({
          name: 'LCP',
          value: lastEntry.startTime,
          threshold: PERFORMANCE_THRESHOLDS.LCP,
          timestamp: Date.now(),
          url: window.location.href,
        });
      });
      
      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (error) {
        console.warn('LCP observer not supported', error);
      }

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          this.recordMetric({
            name: 'FID',
            value: entry.processingStart - entry.startTime,
            threshold: PERFORMANCE_THRESHOLDS.FID,
            timestamp: Date.now(),
            url: window.location.href,
          });
        });
      });
      
      try {
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (error) {
        console.warn('FID observer not supported', error);
      }

      // Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        
        if (clsValue > 0) {
          this.recordMetric({
            name: 'CLS',
            value: clsValue,
            threshold: PERFORMANCE_THRESHOLDS.CLS,
            timestamp: Date.now(),
            url: window.location.href,
          });
        }
      });
      
      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (error) {
        console.warn('CLS observer not supported', error);
      }

      // Navigation timing
      const navigationObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          this.recordMetric({
            name: 'Page_Load',
            value: entry.loadEventEnd - entry.loadEventStart,
            threshold: PERFORMANCE_THRESHOLDS.LEARNING_SESSION_LOAD,
            timestamp: Date.now(),
            url: window.location.href,
            context: {
              domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
              domInteractive: entry.domInteractive - entry.navigationStart,
              networkTime: entry.responseEnd - entry.requestStart,
            },
          });
        });
      });
      
      try {
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (error) {
        console.warn('Navigation observer not supported', error);
      }

      // Resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (entry.duration > PERFORMANCE_THRESHOLDS.API_RESPONSE) {
            this.recordMetric({
              name: 'Resource_Load',
              value: entry.duration,
              threshold: PERFORMANCE_THRESHOLDS.API_RESPONSE,
              timestamp: Date.now(),
              url: window.location.href,
              context: {
                resourceName: entry.name,
                resourceType: entry.initiatorType,
                transferSize: entry.transferSize,
              },
            });
          }
        });
      });
      
      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (error) {
        console.warn('Resource observer not supported', error);
      }
    }
  }

  private startMemoryMonitoring() {
    // Monitor memory usage every 30 seconds
    this.memoryCheckInterval = setInterval(() => {
      if ('memory' in performance) {
        const memoryInfo = (performance as any).memory;
        
        this.recordMetric({
          name: 'Memory_Usage',
          value: memoryInfo.usedJSHeapSize,
          threshold: PERFORMANCE_THRESHOLDS.MEMORY_USAGE,
          timestamp: Date.now(),
          url: window.location.href,
          context: {
            totalJSHeapSize: memoryInfo.totalJSHeapSize,
            jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit,
          },
        });

        // Check for potential memory leaks
        if (memoryInfo.usedJSHeapSize > PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD) {
          this.recordMetric({
            name: 'Potential_Memory_Leak',
            value: memoryInfo.usedJSHeapSize,
            threshold: PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD,
            timestamp: Date.now(),
            url: window.location.href,
            context: {
              totalJSHeapSize: memoryInfo.totalJSHeapSize,
              jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit,
              warning: 'High memory usage detected',
            },
          });
        }
      }
    }, 30000);
  }

  recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Report to Sentry if threshold exceeded
    if (metric.value > metric.threshold) {
      const error = new Error(`Performance threshold exceeded: ${metric.name}`);
      capturePerformanceError(error, {
        metric: metric.name,
        value: metric.value,
        threshold: metric.threshold,
        url: metric.url,
        userId: metric.userId,
      });
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      const status = metric.value > metric.threshold ? '❌' : '✅';
      console.log(`${status} ${metric.name}: ${metric.value.toFixed(2)} (threshold: ${metric.threshold})`);
    }
  }

  // Learning-specific performance monitoring
  measureLearningSessionLoad(sessionId: string, userId?: string) {
    const startTime = performance.now();
    
    return {
      complete: () => {
        const duration = performance.now() - startTime;
        this.recordMetric({
          name: 'Learning_Session_Load',
          value: duration,
          threshold: PERFORMANCE_THRESHOLDS.LEARNING_SESSION_LOAD,
          timestamp: Date.now(),
          url: window.location.href,
          userId,
          sessionId,
          context: { sessionId },
        });
      },
    };
  }

  measureQuizResponse(questionId: string, userId?: string) {
    const startTime = performance.now();
    
    return {
      complete: () => {
        const duration = performance.now() - startTime;
        this.recordMetric({
          name: 'Quiz_Response_Time',
          value: duration,
          threshold: PERFORMANCE_THRESHOLDS.QUIZ_RESPONSE,
          timestamp: Date.now(),
          url: window.location.href,
          userId,
          context: { questionId },
        });
      },
    };
  }

  measureComponentRender(componentName: string) {
    const startTime = performance.now();
    
    return {
      complete: () => {
        const duration = performance.now() - startTime;
        this.recordMetric({
          name: 'Component_Render_Time',
          value: duration,
          threshold: PERFORMANCE_THRESHOLDS.COMPONENT_RENDER,
          timestamp: Date.now(),
          url: window.location.href,
          context: { componentName },
        });
      },
    };
  }

  measureApiCall(endpoint: string, userId?: string) {
    const startTime = performance.now();
    
    return {
      complete: (statusCode?: number) => {
        const duration = performance.now() - startTime;
        this.recordMetric({
          name: 'API_Response_Time',
          value: duration,
          threshold: PERFORMANCE_THRESHOLDS.API_RESPONSE,
          timestamp: Date.now(),
          url: window.location.href,
          userId,
          context: { 
            endpoint,
            statusCode,
          },
        });
      },
    };
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(metric => metric.name === name);
  }

  clearMetrics() {
    this.metrics = [];
  }

  exportMetrics(): string {
    const data = {
      metrics: this.metrics,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };
    
    return JSON.stringify(data, null, 2);
  }

  destroy() {
    // Clean up observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    
    // Clear memory monitoring
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = undefined;
    }
    
    // Clear metrics
    this.metrics = [];
  }
}

// React hooks for performance monitoring
export function usePerformanceMonitoring() {
  const monitor = PerformanceMonitor.getInstance();
  
  return {
    measureLearningSessionLoad: monitor.measureLearningSessionLoad.bind(monitor),
    measureQuizResponse: monitor.measureQuizResponse.bind(monitor),
    measureComponentRender: monitor.measureComponentRender.bind(monitor),
    measureApiCall: monitor.measureApiCall.bind(monitor),
    recordMetric: monitor.recordMetric.bind(monitor),
    getMetrics: monitor.getMetrics.bind(monitor),
    exportMetrics: monitor.exportMetrics.bind(monitor),
  };
}

// HOC for component performance monitoring
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent = (props: P) => {
    const monitor = PerformanceMonitor.getInstance();
    const measurement = monitor.measureComponentRender(componentName || Component.displayName || Component.name);
    
    React.useEffect(() => {
      measurement.complete();
    });
    
    return React.createElement(Component, props);
  };
  
  WrappedComponent.displayName = `withPerformanceMonitoring(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Utility functions
export function reportWebVitals() {
  if (typeof window !== 'undefined' && 'web-vitals' in window) {
    // This would typically use the web-vitals library
    console.log('Web Vitals reporting enabled');
  }
}

export function startPerformanceTransaction(name: string, op: string = 'navigation') {
  return startSentryTransaction(name, op);
}

export function measureAsync<T>(
  name: string,
  asyncFunction: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  const transaction = startSentryTransaction(name, 'async_operation', { extra: context });
  const span = startSentrySpan(transaction, name, 'async_function');
  
  return asyncFunction()
    .then((result) => {
      span.setStatus('ok');
      return result;
    })
    .catch((error) => {
      span.setStatus('internal_error');
      throw error;
    })
    .finally(() => {
      span.finish();
      transaction.finish();
    });
}

// Initialize performance monitoring
export function initializePerformanceMonitoring() {
  const monitor = PerformanceMonitor.getInstance();
  
  // Set up global performance tracking
  if (typeof window !== 'undefined') {
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        Sentry.addBreadcrumb({
          message: 'Page became hidden',
          category: 'navigation',
          level: 'info',
        });
      } else {
        Sentry.addBreadcrumb({
          message: 'Page became visible',
          category: 'navigation',
          level: 'info',
        });
      }
    });
    
    // Track network status changes
    window.addEventListener('online', () => {
      Sentry.addBreadcrumb({
        message: 'Network came online',
        category: 'network',
        level: 'info',
      });
    });
    
    window.addEventListener('offline', () => {
      Sentry.addBreadcrumb({
        message: 'Network went offline',
        category: 'network',
        level: 'warning',
      });
    });
  }
  
  return monitor;
}

export default PerformanceMonitor;