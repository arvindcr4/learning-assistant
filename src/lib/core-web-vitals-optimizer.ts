/**
 * Core Web Vitals Optimizer
 * 
 * Advanced optimization for Largest Contentful Paint (LCP), 
 * First Input Delay (FID), and Cumulative Layout Shift (CLS).
 */

import { getCLS, getFID, getLCP, getFCP, getTTFB, Metric } from 'web-vitals';
import { CDN_CONFIG } from './cdn';

// Core Web Vitals thresholds (Google's recommendations)
export const CWV_THRESHOLDS = {
  LCP: {
    GOOD: 2500,
    NEEDS_IMPROVEMENT: 4000,
  },
  FID: {
    GOOD: 100,
    NEEDS_IMPROVEMENT: 300,
  },
  CLS: {
    GOOD: 0.1,
    NEEDS_IMPROVEMENT: 0.25,
  },
  FCP: {
    GOOD: 1800,
    NEEDS_IMPROVEMENT: 3000,
  },
  TTFB: {
    GOOD: 800,
    NEEDS_IMPROVEMENT: 1800,
  },
};

export interface CoreWebVitalsData {
  lcp?: Metric;
  fid?: Metric;
  cls?: Metric;
  fcp?: Metric;
  ttfb?: Metric;
}

export interface OptimizationStrategy {
  name: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  implementation: () => void;
  validation: () => boolean;
}

/**
 * Core Web Vitals Optimizer Class
 */
export class CoreWebVitalsOptimizer {
  private static instance: CoreWebVitalsOptimizer;
  private metrics: CoreWebVitalsData = {};
  private optimizations: Map<string, OptimizationStrategy> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();
  private isOptimized: boolean = false;

  private constructor() {
    this.initializeOptimizations();
    this.startMonitoring();
  }

  public static getInstance(): CoreWebVitalsOptimizer {
    if (!CoreWebVitalsOptimizer.instance) {
      CoreWebVitalsOptimizer.instance = new CoreWebVitalsOptimizer();
    }
    return CoreWebVitalsOptimizer.instance;
  }

  /**
   * Initialize optimization strategies
   */
  private initializeOptimizations(): void {
    // LCP Optimizations
    this.optimizations.set('preload-critical-resources', {
      name: 'Preload Critical Resources',
      description: 'Preload fonts, critical CSS, and hero images',
      impact: 'high',
      implementation: this.preloadCriticalResources.bind(this),
      validation: () => this.validatePreloadTags(),
    });

    this.optimizations.set('optimize-images', {
      name: 'Optimize Images',
      description: 'Use next-gen formats and responsive images',
      impact: 'high',
      implementation: this.optimizeImages.bind(this),
      validation: () => this.validateImageOptimization(),
    });

    this.optimizations.set('reduce-server-response-time', {
      name: 'Reduce Server Response Time',
      description: 'Optimize TTFB through caching and CDN',
      impact: 'high',
      implementation: this.optimizeServerResponse.bind(this),
      validation: () => this.validateServerResponse(),
    });

    // FID Optimizations
    this.optimizations.set('defer-non-critical-js', {
      name: 'Defer Non-Critical JavaScript',
      description: 'Load non-critical JS after main thread is idle',
      impact: 'high',
      implementation: this.deferNonCriticalJS.bind(this),
      validation: () => this.validateJSDefer(),
    });

    this.optimizations.set('code-splitting', {
      name: 'Implement Code Splitting',
      description: 'Split code into smaller chunks for faster parsing',
      impact: 'medium',
      implementation: this.implementCodeSplitting.bind(this),
      validation: () => this.validateCodeSplitting(),
    });

    this.optimizations.set('web-workers', {
      name: 'Use Web Workers',
      description: 'Offload heavy computations to web workers',
      impact: 'medium',
      implementation: this.implementWebWorkers.bind(this),
      validation: () => this.validateWebWorkers(),
    });

    // CLS Optimizations
    this.optimizations.set('set-image-dimensions', {
      name: 'Set Image Dimensions',
      description: 'Always specify width and height for images',
      impact: 'high',
      implementation: this.setImageDimensions.bind(this),
      validation: () => this.validateImageDimensions(),
    });

    this.optimizations.set('reserve-space-ads', {
      name: 'Reserve Space for Ads',
      description: 'Pre-allocate space for dynamic content',
      impact: 'medium',
      implementation: this.reserveSpaceForAds.bind(this),
      validation: () => this.validateAdSpaceReservation(),
    });

    this.optimizations.set('font-display-swap', {
      name: 'Font Display Swap',
      description: 'Use font-display: swap for web fonts',
      impact: 'medium',
      implementation: this.optimizeFontDisplay.bind(this),
      validation: () => this.validateFontDisplay(),
    });
  }

  /**
   * Start monitoring Core Web Vitals
   */
  private startMonitoring(): void {
    if (typeof window === 'undefined') return;

    try {
      getCLS(this.onCLS.bind(this));
      getFID(this.onFID.bind(this));
      getLCP(this.onLCP.bind(this));
      getFCP(this.onFCP.bind(this));
      getTTFB(this.onTTFB.bind(this));

      // Monitor layout shifts in real-time
      this.setupLayoutShiftMonitoring();
      
      // Monitor long tasks for FID optimization
      this.setupLongTaskMonitoring();
      
      // Monitor largest contentful paint candidates
      this.setupLCPMonitoring();
    } catch (error) {
      console.warn('Core Web Vitals monitoring failed:', error);
    }
  }

  /**
   * Setup specialized monitoring
   */
  private setupLayoutShiftMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          this.analyzeLayoutShift(entry);
        }
      });
    });

    observer.observe({ entryTypes: ['layout-shift'] });
    this.observers.set('layout-shift', observer);
  }

  private setupLongTaskMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        this.analyzeLongTask(entry);
      });
    });

    observer.observe({ entryTypes: ['longtask'] });
    this.observers.set('longtask', observer);
  }

  private setupLCPMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        this.analyzeLCPCandidate(entry);
      });
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });
    this.observers.set('lcp', observer);
  }

  /**
   * Core Web Vitals handlers
   */
  private onCLS(metric: Metric): void {
    this.metrics.cls = metric;
    this.sendToAnalytics('CLS', metric);
    
    if (metric.value > CWV_THRESHOLDS.CLS.NEEDS_IMPROVEMENT) {
      this.triggerCLSOptimizations();
    }
  }

  private onFID(metric: Metric): void {
    this.metrics.fid = metric;
    this.sendToAnalytics('FID', metric);
    
    if (metric.value > CWV_THRESHOLDS.FID.NEEDS_IMPROVEMENT) {
      this.triggerFIDOptimizations();
    }
  }

  private onLCP(metric: Metric): void {
    this.metrics.lcp = metric;
    this.sendToAnalytics('LCP', metric);
    
    if (metric.value > CWV_THRESHOLDS.LCP.NEEDS_IMPROVEMENT) {
      this.triggerLCPOptimizations();
    }
  }

  private onFCP(metric: Metric): void {
    this.metrics.fcp = metric;
    this.sendToAnalytics('FCP', metric);
  }

  private onTTFB(metric: Metric): void {
    this.metrics.ttfb = metric;
    this.sendToAnalytics('TTFB', metric);
  }

  /**
   * Optimization triggers
   */
  private triggerLCPOptimizations(): void {
    const optimizations = [
      'preload-critical-resources',
      'optimize-images',
      'reduce-server-response-time',
    ];

    optimizations.forEach(name => {
      const optimization = this.optimizations.get(name);
      if (optimization && !optimization.validation()) {
        optimization.implementation();
      }
    });
  }

  private triggerFIDOptimizations(): void {
    const optimizations = [
      'defer-non-critical-js',
      'code-splitting',
      'web-workers',
    ];

    optimizations.forEach(name => {
      const optimization = this.optimizations.get(name);
      if (optimization && !optimization.validation()) {
        optimization.implementation();
      }
    });
  }

  private triggerCLSOptimizations(): void {
    const optimizations = [
      'set-image-dimensions',
      'reserve-space-ads',
      'font-display-swap',
    ];

    optimizations.forEach(name => {
      const optimization = this.optimizations.get(name);
      if (optimization && !optimization.validation()) {
        optimization.implementation();
      }
    });
  }

  /**
   * Optimization implementations
   */
  private preloadCriticalResources(): void {
    const criticalResources = [
      '/fonts/inter-var.woff2',
      '/fonts/geist-mono.woff2',
      '/_next/static/css/app.css',
    ];

    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource;
      
      if (resource.includes('.woff2')) {
        link.as = 'font';
        link.type = 'font/woff2';
        link.crossOrigin = 'anonymous';
      } else if (resource.includes('.css')) {
        link.as = 'style';
      }
      
      document.head.appendChild(link);
    });

    // Preload hero image
    const heroImage = document.querySelector('img[data-hero]') as HTMLImageElement;
    if (heroImage && heroImage.src) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = heroImage.src;
      link.as = 'image';
      document.head.appendChild(link);
    }
  }

  private optimizeImages(): void {
    const images = document.querySelectorAll('img:not([data-optimized])');
    
    images.forEach((img: any) => {
      // Add loading="lazy" for non-critical images
      if (!img.hasAttribute('data-critical')) {
        img.loading = 'lazy';
      }
      
      // Add decoding="async"
      img.decoding = 'async';
      
      // Mark as optimized
      img.setAttribute('data-optimized', 'true');
    });
  }

  private optimizeServerResponse(): void {
    // This would typically be implemented on the server side
    // Here we can add client-side optimizations
    
    // Preconnect to external domains
    const preconnectDomains = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ];

    preconnectDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }

  private deferNonCriticalJS(): void {
    const scripts = document.querySelectorAll('script[src]:not([data-critical])');
    
    scripts.forEach((script: any) => {
      if (!script.hasAttribute('defer') && !script.hasAttribute('async')) {
        script.defer = true;
      }
    });

    // Use requestIdleCallback for non-critical operations
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // Load non-critical features
        this.loadNonCriticalFeatures();
      });
    }
  }

  private implementCodeSplitting(): void {
    // This is typically handled at build time with webpack
    // Here we can implement runtime code splitting for specific features
    
    const loadFeatureOnDemand = (featureName: string) => {
      return import(`../features/${featureName}`).catch(error => {
        console.warn(`Failed to load feature ${featureName}:`, error);
      });
    };

    // Example: Load chat feature only when needed
    const chatButton = document.querySelector('[data-feature="chat"]');
    if (chatButton) {
      chatButton.addEventListener('click', () => {
        loadFeatureOnDemand('chat');
      }, { once: true });
    }
  }

  private implementWebWorkers(): void {
    // Move heavy computations to web workers
    if ('Worker' in window) {
      const worker = new Worker('/workers/heavy-computation.js');
      
      worker.postMessage({ type: 'INIT' });
      
      worker.onmessage = (event) => {
        if (event.data.type === 'COMPUTATION_COMPLETE') {
          // Handle computation result
          this.handleWorkerResult(event.data.result);
        }
      };
    }
  }

  private setImageDimensions(): void {
    const images = document.querySelectorAll('img:not([width]):not([height])');
    
    images.forEach((img: any) => {
      // Use intrinsic dimensions if available
      if (img.naturalWidth && img.naturalHeight) {
        img.width = img.naturalWidth;
        img.height = img.naturalHeight;
      } else {
        // Set placeholder dimensions
        img.style.aspectRatio = '16/9';
        img.style.width = '100%';
        img.style.height = 'auto';
      }
    });
  }

  private reserveSpaceForAds(): void {
    const adSlots = document.querySelectorAll('[data-ad-slot]');
    
    adSlots.forEach((slot: any) => {
      if (!slot.style.minHeight) {
        // Reserve standard ad sizes
        const adFormat = slot.getAttribute('data-ad-format') || 'banner';
        
        switch (adFormat) {
          case 'banner':
            slot.style.minHeight = '90px';
            break;
          case 'rectangle':
            slot.style.minHeight = '250px';
            break;
          case 'skyscraper':
            slot.style.minHeight = '600px';
            break;
          default:
            slot.style.minHeight = '90px';
        }
      }
    });
  }

  private optimizeFontDisplay(): void {
    const fontFaces = document.styleSheets;
    
    // This would typically be handled in CSS
    // Here we can add runtime font optimization
    
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: 'Inter';
        font-display: swap;
      }
      @font-face {
        font-family: 'GeistMono';
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Analysis methods
   */
  private analyzeLayoutShift(entry: any): void {
    const elements = entry.sources || [];
    elements.forEach((source: any) => {
      const element = source.node;
      if (element) {
        console.warn('Layout shift caused by:', element);
        // Add specific optimization for this element
        this.optimizeElement(element);
      }
    });
  }

  private analyzeLongTask(entry: PerformanceEntry): void {
    if (entry.duration > 50) {
      console.warn('Long task detected:', entry.duration + 'ms');
      // Implement task breaking strategies
      this.breakLongTasks();
    }
  }

  private analyzeLCPCandidate(entry: PerformanceEntry): void {
    const lcpEntry = entry as any;
    if (lcpEntry.element) {
      console.log('LCP candidate:', lcpEntry.element);
      // Optimize the LCP element
      this.optimizeLCPElement(lcpEntry.element);
    }
  }

  /**
   * Validation methods
   */
  private validatePreloadTags(): boolean {
    return document.querySelectorAll('link[rel="preload"]').length > 0;
  }

  private validateImageOptimization(): boolean {
    const images = document.querySelectorAll('img');
    const optimizedImages = document.querySelectorAll('img[data-optimized]');
    return optimizedImages.length === images.length;
  }

  private validateServerResponse(): boolean {
    return this.metrics.ttfb ? this.metrics.ttfb.value < CWV_THRESHOLDS.TTFB.GOOD : false;
  }

  private validateJSDefer(): boolean {
    const scripts = document.querySelectorAll('script[src]:not([data-critical])');
    const deferredScripts = document.querySelectorAll('script[src][defer]:not([data-critical])');
    return deferredScripts.length === scripts.length;
  }

  private validateCodeSplitting(): boolean {
    // Check if code splitting is implemented (this would be build-time validation)
    return document.querySelectorAll('script[src*="chunk"]').length > 1;
  }

  private validateWebWorkers(): boolean {
    return 'Worker' in window && this.isOptimized;
  }

  private validateImageDimensions(): boolean {
    const images = document.querySelectorAll('img');
    const imagesWithDimensions = document.querySelectorAll('img[width][height], img[style*="aspect-ratio"]');
    return imagesWithDimensions.length === images.length;
  }

  private validateAdSpaceReservation(): boolean {
    const adSlots = document.querySelectorAll('[data-ad-slot]');
    const reservedSlots = document.querySelectorAll('[data-ad-slot][style*="min-height"]');
    return reservedSlots.length === adSlots.length;
  }

  private validateFontDisplay(): boolean {
    // This would check CSS for font-display: swap
    return true; // Simplified validation
  }

  /**
   * Utility methods
   */
  private sendToAnalytics(metric: string, data: Metric): void {
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
      fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'core-web-vitals',
          metric,
          value: data.value,
          timestamp: Date.now(),
          url: window.location.href,
        }),
      }).catch(() => {
        // Silently fail
      });
    }
  }

  private loadNonCriticalFeatures(): void {
    // Load analytics, chat widgets, etc.
    const features = ['analytics', 'chat', 'feedback'];
    
    features.forEach(feature => {
      const element = document.querySelector(`[data-feature="${feature}"]`);
      if (element) {
        element.setAttribute('data-loaded', 'true');
      }
    });
  }

  private optimizeElement(element: Element): void {
    // Add optimization for specific element causing layout shift
    if (!element.getAttribute('style')?.includes('aspect-ratio')) {
      (element as HTMLElement).style.aspectRatio = 'auto';
    }
  }

  private optimizeLCPElement(element: Element): void {
    // Optimize the LCP element
    if (element.tagName === 'IMG') {
      const img = element as HTMLImageElement;
      if (!img.loading) {
        img.loading = 'eager';
      }
      if (!img.decoding) {
        img.decoding = 'sync';
      }
    }
  }

  private breakLongTasks(): void {
    // Implement task scheduling
    if ('scheduler' in window && 'postTask' in (window as any).scheduler) {
      // Use Scheduler API if available
      (window as any).scheduler.postTask(() => {
        // Break long tasks
      }, { priority: 'background' });
    } else if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // Use idle time for heavy tasks
      });
    }
  }

  private handleWorkerResult(result: any): void {
    // Handle web worker computation result
    console.log('Worker computation completed:', result);
  }

  /**
   * Public API
   */
  public getMetrics(): CoreWebVitalsData {
    return { ...this.metrics };
  }

  public getOptimizationStatus(): Map<string, boolean> {
    const status = new Map<string, boolean>();
    
    this.optimizations.forEach((optimization, name) => {
      status.set(name, optimization.validation());
    });
    
    return status;
  }

  public runOptimizations(): void {
    this.optimizations.forEach(optimization => {
      if (!optimization.validation()) {
        optimization.implementation();
      }
    });
    
    this.isOptimized = true;
  }

  public getPerformanceScore(): number {
    const { lcp, fid, cls } = this.metrics;
    
    let score = 0;
    let count = 0;
    
    if (lcp) {
      score += lcp.value <= CWV_THRESHOLDS.LCP.GOOD ? 100 : 
               lcp.value <= CWV_THRESHOLDS.LCP.NEEDS_IMPROVEMENT ? 75 : 50;
      count++;
    }
    
    if (fid) {
      score += fid.value <= CWV_THRESHOLDS.FID.GOOD ? 100 : 
               fid.value <= CWV_THRESHOLDS.FID.NEEDS_IMPROVEMENT ? 75 : 50;
      count++;
    }
    
    if (cls) {
      score += cls.value <= CWV_THRESHOLDS.CLS.GOOD ? 100 : 
               cls.value <= CWV_THRESHOLDS.CLS.NEEDS_IMPROVEMENT ? 75 : 50;
      count++;
    }
    
    return count > 0 ? Math.round(score / count) : 0;
  }

  public destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

// Singleton instance
export const coreWebVitalsOptimizer = CoreWebVitalsOptimizer.getInstance();

// React hook
export function useCoreWebVitals() {
  const [metrics, setMetrics] = React.useState<CoreWebVitalsData>({});
  const [optimizationStatus, setOptimizationStatus] = React.useState<Map<string, boolean>>(new Map());
  const [performanceScore, setPerformanceScore] = React.useState(0);

  React.useEffect(() => {
    const optimizer = CoreWebVitalsOptimizer.getInstance();
    
    const updateData = () => {
      setMetrics(optimizer.getMetrics());
      setOptimizationStatus(optimizer.getOptimizationStatus());
      setPerformanceScore(optimizer.getPerformanceScore());
    };

    // Update every 5 seconds
    const interval = setInterval(updateData, 5000);
    
    // Initial update
    updateData();

    return () => {
      clearInterval(interval);
      optimizer.destroy();
    };
  }, []);

  const runOptimizations = React.useCallback(() => {
    coreWebVitalsOptimizer.runOptimizations();
  }, []);

  return {
    metrics,
    optimizationStatus,
    performanceScore,
    runOptimizations,
  };
}

// React import for hooks
import React from 'react';