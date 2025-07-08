/**
 * Performance Monitoring and Core Web Vitals Tracking
 * 
 * This module provides comprehensive performance monitoring,
 * Core Web Vitals tracking, and performance optimization utilities.
 */

import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';
import React from 'react';

// Performance thresholds (Google's Core Web Vitals)
export const PERFORMANCE_THRESHOLDS = {
  // Largest Contentful Paint (LCP)
  LCP: {
    GOOD: 2500,
    NEEDS_IMPROVEMENT: 4000,
  },
  // First Input Delay (FID)
  FID: {
    GOOD: 100,
    NEEDS_IMPROVEMENT: 300,
  },
  // Cumulative Layout Shift (CLS)
  CLS: {
    GOOD: 0.1,
    NEEDS_IMPROVEMENT: 0.25,
  },
  // First Contentful Paint (FCP)
  FCP: {
    GOOD: 1800,
    NEEDS_IMPROVEMENT: 3000,
  },
  // Time to First Byte (TTFB)
  TTFB: {
    GOOD: 800,
    NEEDS_IMPROVEMENT: 1800,
  },
};

// Performance monitoring class
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private observers: Map<string, PerformanceObserver> = new Map();
  private startTime: number = Date.now();
  private isEnabled: boolean = true;

  private constructor() {
    this.initializeMonitoring();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Initialize performance monitoring
   */
  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Monitor Core Web Vitals
    this.initializeCoreWebVitals();
    
    // Monitor resource loading
    this.initializeResourceMonitoring();
    
    // Monitor navigation timing
    this.initializeNavigationMonitoring();
    
    // Monitor paint timing
    this.initializePaintMonitoring();
    
    // Monitor layout shift
    this.initializeLayoutShiftMonitoring();
  }

  /**
   * Initialize Core Web Vitals monitoring
   */
  private initializeCoreWebVitals(): void {
    try {
      getCLS(this.onCLS.bind(this));
      getFID(this.onFID.bind(this));
      getFCP(this.onFCP.bind(this));
      getLCP(this.onLCP.bind(this));
      getTTFB(this.onTTFB.bind(this));
    } catch (error) {
      console.warn('Core Web Vitals monitoring failed:', error);
    }
  }

  /**
   * Handle Core Web Vitals metrics
   */
  private onCLS(metric: Metric): void {
    this.recordMetric({
      name: 'CLS',
      value: metric.value,
      timestamp: Date.now(),
      rating: this.getRating(metric.value, PERFORMANCE_THRESHOLDS.CLS),
      entries: metric.entries,
    });
  }

  private onFID(metric: Metric): void {
    this.recordMetric({
      name: 'FID',
      value: metric.value,
      timestamp: Date.now(),
      rating: this.getRating(metric.value, PERFORMANCE_THRESHOLDS.FID),
      entries: metric.entries,
    });
  }

  private onFCP(metric: Metric): void {
    this.recordMetric({
      name: 'FCP',
      value: metric.value,
      timestamp: Date.now(),
      rating: this.getRating(metric.value, PERFORMANCE_THRESHOLDS.FCP),
      entries: metric.entries,
    });
  }

  private onLCP(metric: Metric): void {
    this.recordMetric({
      name: 'LCP',
      value: metric.value,
      timestamp: Date.now(),
      rating: this.getRating(metric.value, PERFORMANCE_THRESHOLDS.LCP),
      entries: metric.entries,
    });
  }

  private onTTFB(metric: Metric): void {
    this.recordMetric({
      name: 'TTFB',
      value: metric.value,
      timestamp: Date.now(),
      rating: this.getRating(metric.value, PERFORMANCE_THRESHOLDS.TTFB),
      entries: metric.entries,
    });
  }

  /**
   * Initialize resource loading monitoring
   */
  private initializeResourceMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'resource') {
          this.recordResourceMetric(entry as PerformanceResourceTiming);
        }
      });
    });

    observer.observe({ entryTypes: ['resource'] });
    this.observers.set('resource', observer);
  }

  /**
   * Initialize navigation timing monitoring
   */
  private initializeNavigationMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'navigation') {
          this.recordNavigationMetric(entry as PerformanceNavigationTiming);
        }
      });
    });

    observer.observe({ entryTypes: ['navigation'] });
    this.observers.set('navigation', observer);
  }

  /**
   * Initialize paint timing monitoring
   */
  private initializePaintMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'paint') {
          this.recordPaintMetric(entry as PerformancePaintTiming);
        }
      });
    });

    observer.observe({ entryTypes: ['paint'] });
    this.observers.set('paint', observer);
  }

  /**
   * Initialize layout shift monitoring
   */
  private initializeLayoutShiftMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          this.recordLayoutShiftMetric(entry as any);
        }
      });
    });

    observer.observe({ entryTypes: ['layout-shift'] });
    this.observers.set('layout-shift', observer);
  }

  /**
   * Record performance metrics
   */
  private recordMetric(metric: PerformanceMetric): void {
    if (!this.isEnabled) return;

    this.metrics.push(metric);
    this.cleanupOldMetrics();
    
    // Send to analytics if configured
    this.sendToAnalytics(metric);
  }

  private recordResourceMetric(entry: PerformanceResourceTiming): void {
    const metric: PerformanceMetric = {
      name: 'Resource',
      value: entry.duration,
      timestamp: Date.now(),
      rating: entry.duration > 1000 ? 'poor' : entry.duration > 500 ? 'needs-improvement' : 'good',
      entries: [entry],
      metadata: {
        url: entry.name,
        type: this.getResourceType(entry.name),
        size: entry.transferSize,
        cached: entry.transferSize === 0,
      },
    };

    this.recordMetric(metric);
  }

  private recordNavigationMetric(entry: PerformanceNavigationTiming): void {
    const metric: PerformanceMetric = {
      name: 'Navigation',
      value: entry.loadEventEnd - entry.navigationStart,
      timestamp: Date.now(),
      rating: this.getRating(entry.loadEventEnd - entry.navigationStart, { GOOD: 2000, NEEDS_IMPROVEMENT: 4000 }),
      entries: [entry],
      metadata: {
        domContentLoaded: entry.domContentLoadedEventEnd - entry.navigationStart,
        domComplete: entry.domComplete - entry.navigationStart,
        redirectCount: entry.redirectCount,
        type: entry.type,
      },
    };

    this.recordMetric(metric);
  }

  private recordPaintMetric(entry: PerformancePaintTiming): void {
    const metric: PerformanceMetric = {
      name: entry.name as 'first-paint' | 'first-contentful-paint',
      value: entry.startTime,
      timestamp: Date.now(),
      rating: this.getRating(entry.startTime, PERFORMANCE_THRESHOLDS.FCP),
      entries: [entry],
    };

    this.recordMetric(metric);
  }

  private recordLayoutShiftMetric(entry: any): void {
    const metric: PerformanceMetric = {
      name: 'Layout Shift',
      value: entry.value,
      timestamp: Date.now(),
      rating: this.getRating(entry.value, PERFORMANCE_THRESHOLDS.CLS),
      entries: [entry],
      metadata: {
        hadRecentInput: entry.hadRecentInput,
        sources: entry.sources?.map((source: any) => ({
          node: source.node?.tagName,
          currentRect: source.currentRect,
          previousRect: source.previousRect,
        })),
      },
    };

    this.recordMetric(metric);
  }

  /**
   * Get performance rating
   */
  private getRating(value: number, thresholds: { GOOD: number; NEEDS_IMPROVEMENT: number }): PerformanceRating {
    if (value <= thresholds.GOOD) return 'good';
    if (value <= thresholds.NEEDS_IMPROVEMENT) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get resource type from URL
   */
  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (['js', 'mjs'].includes(extension || '')) return 'script';
    if (['css'].includes(extension || '')) return 'stylesheet';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(extension || '')) return 'image';
    if (['woff', 'woff2', 'ttf', 'otf'].includes(extension || '')) return 'font';
    if (url.includes('/api/')) return 'api';
    
    return 'other';
  }

  /**
   * Send metrics to analytics
   */
  private sendToAnalytics(metric: PerformanceMetric): void {
    if (typeof window === 'undefined') return;

    // Send to Google Analytics 4
    if (typeof gtag !== 'undefined') {
      gtag('event', 'performance_metric', {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_rating: metric.rating,
        custom_map: {
          metric_name: 'custom_metric_name',
          metric_value: 'custom_metric_value',
        },
      });
    }

    // Send to custom analytics endpoint
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
      fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'performance',
          metric,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: Date.now(),
        }),
      }).catch(() => {
        // Silently fail - don't let analytics errors affect the app
      });
    }
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): PerformanceSummary {
    const coreWebVitals = this.getCoreWebVitals();
    const resourceMetrics = this.getResourceMetrics();
    
    return {
      coreWebVitals,
      resourceMetrics,
      overallScore: this.calculateOverallScore(coreWebVitals),
      recommendations: this.getRecommendations(coreWebVitals, resourceMetrics),
    };
  }

  /**
   * Get Core Web Vitals metrics
   */
  private getCoreWebVitals(): CoreWebVitals {
    const getLatestMetric = (name: string) => {
      return this.metrics
        .filter(m => m.name === name)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
    };

    return {
      lcp: getLatestMetric('LCP'),
      fid: getLatestMetric('FID'),
      cls: getLatestMetric('CLS'),
      fcp: getLatestMetric('FCP'),
      ttfb: getLatestMetric('TTFB'),
    };
  }

  /**
   * Get resource metrics summary
   */
  private getResourceMetrics(): ResourceMetrics {
    const resourceMetrics = this.metrics.filter(m => m.name === 'Resource');
    
    const byType = resourceMetrics.reduce((acc, metric) => {
      const type = metric.metadata?.type || 'other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(metric);
      return acc;
    }, {} as Record<string, PerformanceMetric[]>);

    return {
      total: resourceMetrics.length,
      byType,
      averageLoadTime: this.calculateAverageLoadTime(resourceMetrics),
      slowestResources: this.getTopSlowResources(resourceMetrics),
    };
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(coreWebVitals: CoreWebVitals): number {
    const metrics = Object.values(coreWebVitals).filter(Boolean);
    const scores = metrics.map(metric => {
      switch (metric.rating) {
        case 'good': return 100;
        case 'needs-improvement': return 75;
        case 'poor': return 50;
        default: return 0;
      }
    });

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Get performance recommendations
   */
  private getRecommendations(coreWebVitals: CoreWebVitals, resourceMetrics: ResourceMetrics): string[] {
    const recommendations: string[] = [];

    // LCP recommendations
    if (coreWebVitals.lcp?.rating === 'poor') {
      recommendations.push('Optimize largest contentful paint by reducing server response time and optimizing images');
    }

    // FID recommendations
    if (coreWebVitals.fid?.rating === 'poor') {
      recommendations.push('Improve first input delay by reducing JavaScript execution time and implementing code splitting');
    }

    // CLS recommendations
    if (coreWebVitals.cls?.rating === 'poor') {
      recommendations.push('Reduce cumulative layout shift by setting dimensions on images and avoiding dynamic content insertion');
    }

    // Resource recommendations
    if (resourceMetrics.averageLoadTime > 1000) {
      recommendations.push('Optimize resource loading by enabling compression and using a CDN');
    }

    return recommendations;
  }

  /**
   * Utility methods
   */
  private calculateAverageLoadTime(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length;
  }

  private getTopSlowResources(metrics: PerformanceMetric[], limit: number = 5): PerformanceMetric[] {
    return metrics
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  private cleanupOldMetrics(): void {
    const oneHourAgo = Date.now() - 3600000;
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
  }

  /**
   * Public API methods
   */
  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public clearMetrics(): void {
    this.metrics = [];
  }

  public getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  public destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.metrics = [];
  }
}

// React hook for performance monitoring
export function usePerformanceMonitoring() {
  const monitor = PerformanceMonitor.getInstance();
  
  const [performanceData, setPerformanceData] = React.useState<PerformanceSummary | null>(null);

  React.useEffect(() => {
    const updatePerformanceData = () => {
      setPerformanceData(monitor.getPerformanceSummary());
    };

    // Update performance data every 5 seconds
    const interval = setInterval(updatePerformanceData, 5000);
    
    // Initial update
    updatePerformanceData();

    return () => clearInterval(interval);
  }, [monitor]);

  return {
    performanceData,
    clearMetrics: () => monitor.clearMetrics(),
    getMetrics: () => monitor.getMetrics(),
  };
}

// Performance optimization utilities
export class PerformanceOptimizer {
  /**
   * Optimize images with lazy loading
   */
  public static optimizeImages(): void {
    if (typeof window === 'undefined') return;

    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src || '';
          img.classList.remove('lazy');
          imageObserver.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  }

  /**
   * Preload critical resources
   */
  public static preloadCriticalResources(resources: string[]): void {
    if (typeof window === 'undefined') return;

    resources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource;
      
      if (resource.endsWith('.css')) {
        link.as = 'style';
      } else if (resource.endsWith('.js')) {
        link.as = 'script';
      } else if (resource.match(/\.(jpg|jpeg|png|gif|webp|avif)$/)) {
        link.as = 'image';
      }
      
      document.head.appendChild(link);
    });
  }

  /**
   * Optimize font loading
   */
  public static optimizeFonts(): void {
    if (typeof window === 'undefined') return;

    const fontLinks = document.querySelectorAll('link[rel="stylesheet"][href*="fonts"]');
    fontLinks.forEach(link => {
      (link as HTMLLinkElement).rel = 'preload';
      (link as HTMLLinkElement).as = 'style';
    });
  }
}

// Type definitions
export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  rating: PerformanceRating;
  entries: PerformanceEntry[];
  metadata?: Record<string, any>;
}

export type PerformanceRating = 'good' | 'needs-improvement' | 'poor';

export interface CoreWebVitals {
  lcp?: PerformanceMetric;
  fid?: PerformanceMetric;
  cls?: PerformanceMetric;
  fcp?: PerformanceMetric;
  ttfb?: PerformanceMetric;
}

export interface ResourceMetrics {
  total: number;
  byType: Record<string, PerformanceMetric[]>;
  averageLoadTime: number;
  slowestResources: PerformanceMetric[];
}

export interface PerformanceSummary {
  coreWebVitals: CoreWebVitals;
  resourceMetrics: ResourceMetrics;
  overallScore: number;
  recommendations: string[];
}

// Singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();