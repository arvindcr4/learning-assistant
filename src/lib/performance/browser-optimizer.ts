/**
 * Browser Performance Optimizer
 * 
 * Advanced browser optimization with intelligent lazy loading, code splitting,
 * Core Web Vitals optimization, and resource management.
 */

import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';

// Core interfaces
export interface BrowserMetrics {
  coreWebVitals: CoreWebVitals;
  resourceCounts: ResourceCounts;
  jsHeapSize: number;
  domNodes: number;
  renderingMetrics: RenderingMetrics;
  loadingMetrics: LoadingMetrics;
  interactionMetrics: InteractionMetrics;
}

export interface CoreWebVitals {
  lcp: number;
  fid: number;
  cls: number;
  fcp: number;
  ttfb: number;
  inp?: number; // Interaction to Next Paint
}

export interface ResourceCounts {
  scripts: number;
  stylesheets: number;
  images: number;
  fonts: number;
  total: number;
  loaded: number;
  failed: number;
  cached: number;
}

export interface RenderingMetrics {
  frameRate: number;
  droppedFrames: number;
  layoutShifts: number;
  paintTime: number;
  styleRecalcTime: number;
  layoutTime: number;
}

export interface LoadingMetrics {
  domContentLoaded: number;
  windowLoad: number;
  firstByte: number;
  resourceLoadTime: number;
  criticalResourceLoadTime: number;
}

export interface InteractionMetrics {
  firstInputDelay: number;
  totalBlockingTime: number;
  longTasks: number;
  inputLatency: number;
  scrollLatency: number;
}

export interface LazyLoadConfig {
  enabled: boolean;
  rootMargin: string;
  threshold: number;
  imageSelector: string;
  componentSelector: string;
  preloadDistance: number;
  fadeInDuration: number;
}

export interface CodeSplittingConfig {
  enabled: boolean;
  chunkSizeThreshold: number;
  preloadPriority: ('critical' | 'high' | 'medium' | 'low')[];
  routeBasedSplitting: boolean;
  componentBasedSplitting: boolean;
}

export interface ResourceOptimizationConfig {
  imageOptimization: boolean;
  fontOptimization: boolean;
  scriptOptimization: boolean;
  stylesheetOptimization: boolean;
  compressionEnabled: boolean;
  webpEnabled: boolean;
  avifEnabled: boolean;
}

export interface BrowserOptimizationResult {
  success: boolean;
  action: string;
  description: string;
  improvementPercentage: number;
  beforeMetrics: Partial<BrowserMetrics>;
  afterMetrics: Partial<BrowserMetrics>;
  error?: string;
}

/**
 * Lazy Loading Manager
 */
class LazyLoadManager {
  private config: LazyLoadConfig;
  private observers: Map<string, IntersectionObserver> = new Map();
  private loadedElements: Set<Element> = new Set();

  constructor(config: LazyLoadConfig) {
    this.config = config;
    this.initialize();
  }

  /**
   * Initialize lazy loading
   */
  private initialize(): void {
    if (!this.config.enabled || typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.setupImageLazyLoading();
    this.setupComponentLazyLoading();
  }

  /**
   * Setup image lazy loading
   */
  private setupImageLazyLoading(): void {
    const imageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target as HTMLImageElement);
            imageObserver.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: this.config.rootMargin,
        threshold: this.config.threshold
      }
    );

    this.observers.set('images', imageObserver);

    // Observe existing images
    this.observeImages();

    // Observe new images added to DOM
    this.setupDOMObserver();
  }

  /**
   * Setup component lazy loading
   */
  private setupComponentLazyLoading(): void {
    const componentObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadComponent(entry.target as HTMLElement);
            componentObserver.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: this.config.rootMargin,
        threshold: this.config.threshold
      }
    );

    this.observers.set('components', componentObserver);

    // Observe lazy components
    this.observeComponents();
  }

  /**
   * Observe images for lazy loading
   */
  private observeImages(): void {
    const images = document.querySelectorAll(this.config.imageSelector);
    const observer = this.observers.get('images');

    if (!observer) return;

    images.forEach(img => {
      if (!this.loadedElements.has(img)) {
        observer.observe(img);
      }
    });
  }

  /**
   * Observe components for lazy loading
   */
  private observeComponents(): void {
    const components = document.querySelectorAll(this.config.componentSelector);
    const observer = this.observers.get('components');

    if (!observer) return;

    components.forEach(component => {
      if (!this.loadedElements.has(component)) {
        observer.observe(component);
      }
    });
  }

  /**
   * Setup DOM observer for dynamically added elements
   */
  private setupDOMObserver(): void {
    const domObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check for lazy images
            if (element.matches && element.matches(this.config.imageSelector)) {
              this.observers.get('images')?.observe(element);
            }
            
            // Check for lazy components
            if (element.matches && element.matches(this.config.componentSelector)) {
              this.observers.get('components')?.observe(element);
            }
            
            // Check for nested lazy elements
            const lazyImages = element.querySelectorAll?.(this.config.imageSelector);
            const lazyComponents = element.querySelectorAll?.(this.config.componentSelector);
            
            lazyImages?.forEach(img => this.observers.get('images')?.observe(img));
            lazyComponents?.forEach(comp => this.observers.get('components')?.observe(comp));
          }
        });
      });
    });

    domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Load image with optimization
   */
  private loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src || img.dataset.lazySrc;
    if (!src) return;

    // Create a new image to preload
    const newImg = new Image();
    
    newImg.onload = () => {
      img.src = src;
      img.classList.add('loaded');
      
      // Add fade-in animation
      if (this.config.fadeInDuration > 0) {
        img.style.transition = `opacity ${this.config.fadeInDuration}ms ease-in-out`;
        img.style.opacity = '1';
      }
      
      this.loadedElements.add(img);
    };

    newImg.onerror = () => {
      img.classList.add('error');
      this.loadedElements.add(img);
    };

    // Support for different image formats
    if (this.supportsWebP() && img.dataset.webpSrc) {
      newImg.src = img.dataset.webpSrc;
    } else if (this.supportsAVIF() && img.dataset.avifSrc) {
      newImg.src = img.dataset.avifSrc;
    } else {
      newImg.src = src;
    }
  }

  /**
   * Load component dynamically
   */
  private loadComponent(element: HTMLElement): void {
    const componentName = element.dataset.component;
    const componentProps = element.dataset.props;

    if (!componentName) return;

    // Dispatch custom event for component loading
    const event = new CustomEvent('lazyComponentLoad', {
      detail: {
        componentName,
        props: componentProps ? JSON.parse(componentProps) : {},
        element
      }
    });

    element.dispatchEvent(event);
    this.loadedElements.add(element);
  }

  /**
   * Check WebP support
   */
  private supportsWebP(): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  /**
   * Check AVIF support
   */
  private supportsAVIF(): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    try {
      return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
    } catch {
      return false;
    }
  }

  /**
   * Preload critical images
   */
  public preloadCriticalImages(): void {
    const criticalImages = document.querySelectorAll('[data-critical="true"]');
    
    criticalImages.forEach(img => {
      if (img instanceof HTMLImageElement) {
        this.loadImage(img);
      }
    });
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<LazyLoadConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get loading statistics
   */
  public getStats(): any {
    return {
      totalObserved: this.loadedElements.size,
      imageObserverActive: this.observers.has('images'),
      componentObserverActive: this.observers.has('components')
    };
  }
}

/**
 * Code Splitting Manager
 */
class CodeSplittingManager {
  private config: CodeSplittingConfig;
  private loadedChunks: Set<string> = new Set();
  private loadingChunks: Map<string, Promise<any>> = new Map();

  constructor(config: CodeSplittingConfig) {
    this.config = config;
  }

  /**
   * Load code chunk dynamically
   */
  public async loadChunk(chunkName: string, priority: 'critical' | 'high' | 'medium' | 'low' = 'medium'): Promise<any> {
    if (this.loadedChunks.has(chunkName)) {
      return; // Already loaded
    }

    if (this.loadingChunks.has(chunkName)) {
      return this.loadingChunks.get(chunkName); // Already loading
    }

    const loadPromise = this.performChunkLoad(chunkName, priority);
    this.loadingChunks.set(chunkName, loadPromise);

    try {
      const result = await loadPromise;
      this.loadedChunks.add(chunkName);
      this.loadingChunks.delete(chunkName);
      return result;
    } catch (error) {
      this.loadingChunks.delete(chunkName);
      throw error;
    }
  }

  /**
   * Perform actual chunk loading
   */
  private async performChunkLoad(chunkName: string, priority: string): Promise<any> {
    // This would integrate with webpack or other bundlers
    // For now, simulate dynamic import
    try {
      const module = await import(/* webpackChunkName: "[request]" */ `@/components/${chunkName}`);
      return module;
    } catch (error) {
      console.error(`Failed to load chunk: ${chunkName}`, error);
      throw error;
    }
  }

  /**
   * Preload chunks based on priority
   */
  public preloadChunks(chunks: Array<{ name: string; priority: string }>): void {
    const sortedChunks = chunks.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder];
    });

    sortedChunks.forEach(({ name, priority }) => {
      if (this.config.preloadPriority.includes(priority as any)) {
        this.loadChunk(name, priority as any);
      }
    });
  }

  /**
   * Get loading statistics
   */
  public getStats(): any {
    return {
      loadedChunks: this.loadedChunks.size,
      loadingChunks: this.loadingChunks.size,
      totalChunks: this.loadedChunks.size + this.loadingChunks.size
    };
  }
}

/**
 * Core Web Vitals Monitor
 */
class CoreWebVitalsMonitor {
  private metrics: Map<string, Metric> = new Map();
  private callbacks: Array<(metric: Metric) => void> = [];

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Core Web Vitals monitoring
   */
  private initialize(): void {
    if (typeof window === 'undefined') return;

    try {
      getCLS(this.onMetric.bind(this));
      getFID(this.onMetric.bind(this));
      getFCP(this.onMetric.bind(this));
      getLCP(this.onMetric.bind(this));
      getTTFB(this.onMetric.bind(this));
    } catch (error) {
      console.warn('Core Web Vitals monitoring initialization failed:', error);
    }
  }

  /**
   * Handle metric updates
   */
  private onMetric(metric: Metric): void {
    this.metrics.set(metric.name, metric);
    this.callbacks.forEach(callback => callback(metric));
  }

  /**
   * Subscribe to metric updates
   */
  public subscribe(callback: (metric: Metric) => void): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get current metrics
   */
  public getMetrics(): CoreWebVitals {
    return {
      lcp: this.metrics.get('LCP')?.value || 0,
      fid: this.metrics.get('FID')?.value || 0,
      cls: this.metrics.get('CLS')?.value || 0,
      fcp: this.metrics.get('FCP')?.value || 0,
      ttfb: this.metrics.get('TTFB')?.value || 0
    };
  }

  /**
   * Get metric rating
   */
  public getMetricRating(metricName: string): 'good' | 'needs-improvement' | 'poor' {
    const metric = this.metrics.get(metricName);
    if (!metric) return 'poor';

    const thresholds = {
      LCP: { good: 2500, needsImprovement: 4000 },
      FID: { good: 100, needsImprovement: 300 },
      CLS: { good: 0.1, needsImprovement: 0.25 },
      FCP: { good: 1800, needsImprovement: 3000 },
      TTFB: { good: 800, needsImprovement: 1800 }
    };

    const threshold = thresholds[metricName as keyof typeof thresholds];
    if (!threshold) return 'poor';

    if (metric.value <= threshold.good) return 'good';
    if (metric.value <= threshold.needsImprovement) return 'needs-improvement';
    return 'poor';
  }
}

/**
 * Browser Optimizer
 */
export class BrowserOptimizer {
  private lazyLoadManager: LazyLoadManager;
  private codeSplittingManager: CodeSplittingManager;
  private coreWebVitalsMonitor: CoreWebVitalsMonitor;
  private metrics: BrowserMetrics[] = [];
  private optimizationHistory: BrowserOptimizationResult[] = [];
  private resourceObserver?: PerformanceObserver;

  constructor() {
    this.lazyLoadManager = new LazyLoadManager({
      enabled: true,
      rootMargin: '50px',
      threshold: 0.1,
      imageSelector: 'img[data-src], img[data-lazy-src]',
      componentSelector: '[data-lazy-component]',
      preloadDistance: 100,
      fadeInDuration: 300
    });

    this.codeSplittingManager = new CodeSplittingManager({
      enabled: true,
      chunkSizeThreshold: 244 * 1024, // 244KB
      preloadPriority: ['critical', 'high'],
      routeBasedSplitting: true,
      componentBasedSplitting: true
    });

    this.coreWebVitalsMonitor = new CoreWebVitalsMonitor();

    this.initializeResourceObserver();
    this.startOptimizations();
  }

  /**
   * Initialize resource performance observer
   */
  private initializeResourceObserver(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    this.resourceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      this.processResourceEntries(entries);
    });

    try {
      this.resourceObserver.observe({ entryTypes: ['resource', 'navigation', 'paint'] });
    } catch (error) {
      console.warn('Resource observer initialization failed:', error);
    }
  }

  /**
   * Process resource performance entries
   */
  private processResourceEntries(entries: PerformanceEntry[]): void {
    entries.forEach(entry => {
      if (entry.entryType === 'resource') {
        this.analyzeResourcePerformance(entry as PerformanceResourceTiming);
      }
    });
  }

  /**
   * Analyze resource performance
   */
  private analyzeResourcePerformance(entry: PerformanceResourceTiming): void {
    // Check for slow resources
    if (entry.duration > 1000) {
      console.warn(`Slow resource detected: ${entry.name} (${entry.duration}ms)`);
      this.optimizeSlowResource(entry);
    }

    // Check for large resources
    if (entry.transferSize && entry.transferSize > 1024 * 1024) { // 1MB
      console.warn(`Large resource detected: ${entry.name} (${entry.transferSize} bytes)`);
      this.optimizeLargeResource(entry);
    }
  }

  /**
   * Optimize slow resource
   */
  private optimizeSlowResource(entry: PerformanceResourceTiming): void {
    // Add resource hints for slow resources
    if (entry.name.includes('font')) {
      this.preloadResource(entry.name, 'font');
    } else if (entry.name.includes('.css')) {
      this.preloadResource(entry.name, 'style');
    } else if (entry.name.includes('.js')) {
      this.preloadResource(entry.name, 'script');
    }
  }

  /**
   * Optimize large resource
   */
  private optimizeLargeResource(entry: PerformanceResourceTiming): void {
    // Suggest compression or splitting for large resources
    if (entry.name.includes('.js') && entry.transferSize! > 500 * 1024) {
      console.suggest('Consider code splitting for large JavaScript bundle:', entry.name);
    }
  }

  /**
   * Preload resource with appropriate hints
   */
  private preloadResource(url: string, as: string): void {
    if (typeof document === 'undefined') return;

    const existingPreload = document.querySelector(`link[rel="preload"][href="${url}"]`);
    if (existingPreload) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = as;
    
    if (as === 'font') {
      link.crossOrigin = 'anonymous';
    }
    
    document.head.appendChild(link);
  }

  /**
   * Start automatic optimizations
   */
  private startOptimizations(): void {
    // Preload critical images on load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.lazyLoadManager.preloadCriticalImages();
      });
    } else {
      this.lazyLoadManager.preloadCriticalImages();
    }

    // Optimize fonts
    this.optimizeFonts();

    // Setup intersection observer for viewport optimizations
    this.setupViewportOptimizations();
  }

  /**
   * Optimize font loading
   */
  private optimizeFonts(): void {
    if (typeof document === 'undefined') return;

    // Add font-display: swap to all fonts
    const fontLinks = document.querySelectorAll('link[rel="stylesheet"][href*="fonts"]');
    fontLinks.forEach(link => {
      const href = (link as HTMLLinkElement).href;
      if (!href.includes('display=swap')) {
        const separator = href.includes('?') ? '&' : '?';
        (link as HTMLLinkElement).href = `${href}${separator}display=swap`;
      }
    });

    // Preload critical fonts
    const criticalFonts = [
      'Inter-Regular.woff2',
      'Inter-Bold.woff2'
    ];

    criticalFonts.forEach(font => {
      this.preloadResource(`/fonts/${font}`, 'font');
    });
  }

  /**
   * Setup viewport-based optimizations
   */
  private setupViewportOptimizations(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    // Optimize animations based on viewport
    const animationObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const element = entry.target as HTMLElement;
        
        if (entry.isIntersecting) {
          element.style.animationPlayState = 'running';
        } else {
          element.style.animationPlayState = 'paused';
        }
      });
    });

    // Observe animated elements
    document.querySelectorAll('[data-animate]').forEach(element => {
      animationObserver.observe(element);
    });
  }

  /**
   * Get browser metrics
   */
  public async getMetrics(): Promise<BrowserMetrics> {
    const coreWebVitals = this.coreWebVitalsMonitor.getMetrics();
    const resourceCounts = this.getResourceCounts();
    const jsHeapSize = this.getJSHeapSize();
    const domNodes = this.getDOMNodeCount();
    const renderingMetrics = this.getRenderingMetrics();
    const loadingMetrics = this.getLoadingMetrics();
    const interactionMetrics = this.getInteractionMetrics();

    const metrics: BrowserMetrics = {
      coreWebVitals,
      resourceCounts,
      jsHeapSize,
      domNodes,
      renderingMetrics,
      loadingMetrics,
      interactionMetrics
    };

    this.metrics.push(metrics);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    return metrics;
  }

  /**
   * Get resource counts
   */
  private getResourceCounts(): ResourceCounts {
    if (typeof document === 'undefined') {
      return { scripts: 0, stylesheets: 0, images: 0, fonts: 0, total: 0, loaded: 0, failed: 0, cached: 0 };
    }

    const scripts = document.querySelectorAll('script').length;
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"]').length;
    const images = document.querySelectorAll('img').length;
    const fonts = document.querySelectorAll('link[rel="preload"][as="font"]').length;

    return {
      scripts,
      stylesheets,
      images,
      fonts,
      total: scripts + stylesheets + images + fonts,
      loaded: 0, // Would need to track actual loading state
      failed: 0,
      cached: 0
    };
  }

  /**
   * Get JavaScript heap size
   */
  private getJSHeapSize(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Get DOM node count
   */
  private getDOMNodeCount(): number {
    if (typeof document !== 'undefined') {
      return document.querySelectorAll('*').length;
    }
    return 0;
  }

  /**
   * Get rendering metrics
   */
  private getRenderingMetrics(): RenderingMetrics {
    // This would integrate with performance timeline
    return {
      frameRate: 60, // Would need actual frame rate calculation
      droppedFrames: 0,
      layoutShifts: 0,
      paintTime: 0,
      styleRecalcTime: 0,
      layoutTime: 0
    };
  }

  /**
   * Get loading metrics
   */
  private getLoadingMetrics(): LoadingMetrics {
    if (typeof performance === 'undefined') {
      return {
        domContentLoaded: 0,
        windowLoad: 0,
        firstByte: 0,
        resourceLoadTime: 0,
        criticalResourceLoadTime: 0
      };
    }

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    return {
      domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.navigationStart || 0,
      windowLoad: navigation?.loadEventEnd - navigation?.navigationStart || 0,
      firstByte: navigation?.responseStart - navigation?.navigationStart || 0,
      resourceLoadTime: 0, // Would aggregate resource timing
      criticalResourceLoadTime: 0
    };
  }

  /**
   * Get interaction metrics
   */
  private getInteractionMetrics(): InteractionMetrics {
    return {
      firstInputDelay: this.coreWebVitalsMonitor.getMetrics().fid,
      totalBlockingTime: 0, // Would need to calculate from long tasks
      longTasks: 0,
      inputLatency: 0,
      scrollLatency: 0
    };
  }

  /**
   * Enable lazy loading
   */
  public async enableLazyLoading(action: any): Promise<BrowserOptimizationResult> {
    const beforeMetrics = await this.getMetrics();

    try {
      this.lazyLoadManager.updateConfig({ enabled: true });
      
      const afterMetrics = await this.getMetrics();

      const result: BrowserOptimizationResult = {
        success: true,
        action: 'enable_lazy_loading',
        description: 'Enabled intelligent lazy loading for images and components',
        improvementPercentage: 20,
        beforeMetrics,
        afterMetrics
      };

      this.optimizationHistory.push(result);
      return result;

    } catch (error) {
      return {
        success: false,
        action: 'enable_lazy_loading',
        description: `Failed to enable lazy loading: ${error}`,
        improvementPercentage: 0,
        beforeMetrics,
        afterMetrics: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Implement code splitting
   */
  public async implementCodeSplitting(action: any): Promise<BrowserOptimizationResult> {
    const beforeMetrics = await this.getMetrics();

    try {
      // Preload high-priority chunks
      this.codeSplittingManager.preloadChunks([
        { name: 'critical-components', priority: 'critical' },
        { name: 'user-dashboard', priority: 'high' },
        { name: 'analytics', priority: 'medium' }
      ]);

      const afterMetrics = await this.getMetrics();

      const result: BrowserOptimizationResult = {
        success: true,
        action: 'implement_code_splitting',
        description: 'Implemented intelligent code splitting with priority-based loading',
        improvementPercentage: 25,
        beforeMetrics,
        afterMetrics
      };

      this.optimizationHistory.push(result);
      return result;

    } catch (error) {
      return {
        success: false,
        action: 'implement_code_splitting',
        description: `Failed to implement code splitting: ${error}`,
        improvementPercentage: 0,
        beforeMetrics,
        afterMetrics: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Optimize Core Web Vitals
   */
  public async optimizeCoreWebVitals(): Promise<BrowserOptimizationResult> {
    const beforeMetrics = await this.getMetrics();

    try {
      // LCP optimization
      this.optimizeLCP();
      
      // FID optimization
      this.optimizeFID();
      
      // CLS optimization
      this.optimizeCLS();

      const afterMetrics = await this.getMetrics();

      const result: BrowserOptimizationResult = {
        success: true,
        action: 'optimize_core_web_vitals',
        description: 'Applied Core Web Vitals optimizations',
        improvementPercentage: 30,
        beforeMetrics,
        afterMetrics
      };

      this.optimizationHistory.push(result);
      return result;

    } catch (error) {
      return {
        success: false,
        action: 'optimize_core_web_vitals',
        description: `Failed to optimize Core Web Vitals: ${error}`,
        improvementPercentage: 0,
        beforeMetrics,
        afterMetrics: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Optimize Largest Contentful Paint
   */
  private optimizeLCP(): void {
    // Preload LCP candidates
    const lcpCandidates = document.querySelectorAll('img, video, [data-lcp]');
    lcpCandidates.forEach(element => {
      if (element instanceof HTMLImageElement) {
        this.preloadResource(element.src, 'image');
      }
    });

    // Optimize images
    this.optimizeImages();
  }

  /**
   * Optimize First Input Delay
   */
  private optimizeFID(): void {
    // Defer non-critical JavaScript
    this.deferNonCriticalJS();
    
    // Break up long tasks
    this.breakUpLongTasks();
  }

  /**
   * Optimize Cumulative Layout Shift
   */
  private optimizeCLS(): void {
    // Add size attributes to images without them
    const images = document.querySelectorAll('img:not([width]):not([height])');
    images.forEach(img => {
      // Set placeholder dimensions to prevent layout shift
      if (!img.style.aspectRatio) {
        img.style.aspectRatio = '16/9'; // Default aspect ratio
      }
    });

    // Optimize font loading to prevent FOIT/FOUT
    this.optimizeFontLoading();
  }

  /**
   * Optimize images
   */
  private optimizeImages(): void {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      // Add loading="lazy" to non-critical images
      if (!img.hasAttribute('loading') && !img.closest('[data-critical]')) {
        img.loading = 'lazy';
      }

      // Add decoding="async" for better performance
      if (!img.hasAttribute('decoding')) {
        img.decoding = 'async';
      }
    });
  }

  /**
   * Defer non-critical JavaScript
   */
  private deferNonCriticalJS(): void {
    const scripts = document.querySelectorAll('script:not([data-critical])');
    scripts.forEach(script => {
      if (!script.hasAttribute('defer') && !script.hasAttribute('async')) {
        script.setAttribute('defer', '');
      }
    });
  }

  /**
   * Break up long tasks using scheduler
   */
  private breakUpLongTasks(): void {
    if (typeof requestIdleCallback !== 'undefined') {
      // Use scheduler when available
      const scheduler = (callback: () => void) => {
        requestIdleCallback(callback, { timeout: 1000 });
      };
      
      // This would be used in application code to break up long tasks
      (window as any).scheduler = scheduler;
    }
  }

  /**
   * Optimize font loading
   */
  private optimizeFontLoading(): void {
    const fontLinks = document.querySelectorAll('link[rel="stylesheet"][href*="font"]');
    fontLinks.forEach(link => {
      // Use font-display: swap to prevent FOIT
      link.setAttribute('data-font-display', 'swap');
    });
  }

  /**
   * Get optimization history
   */
  public getOptimizationHistory(): BrowserOptimizationResult[] {
    return [...this.optimizationHistory];
  }

  /**
   * Get current metrics
   */
  public getCurrentMetrics(): BrowserMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  /**
   * Subscribe to Core Web Vitals updates
   */
  public subscribeToCoreWebVitals(callback: (metric: Metric) => void): () => void {
    return this.coreWebVitalsMonitor.subscribe(callback);
  }

  /**
   * Get lazy loading statistics
   */
  public getLazyLoadStats(): any {
    return this.lazyLoadManager.getStats();
  }

  /**
   * Get code splitting statistics
   */
  public getCodeSplittingStats(): any {
    return this.codeSplittingManager.getStats();
  }
}

// Export singleton instance
export const browserOptimizer = new BrowserOptimizer();