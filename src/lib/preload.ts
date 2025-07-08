/**
 * Resource Preloading Strategies
 * 
 * This module provides utilities for preloading critical resources
 * to improve Core Web Vitals and user experience.
 */

import { cdnAssetManager } from './cdn';

// Preload configuration
export const PRELOAD_CONFIG = {
  // Critical resources to preload immediately
  CRITICAL_RESOURCES: [
    '/fonts/inter-var.woff2',
    '/fonts/geist-mono.woff2',
    '/assets/icons/sprite.svg',
  ],
  
  // Resources to preload based on user interaction
  INTERACTION_RESOURCES: [
    '/assets/images/hero-bg.webp',
    '/assets/images/features-grid.webp',
  ],
  
  // Resources to preload on idle
  IDLE_RESOURCES: [
    '/assets/images/testimonials.webp',
    '/assets/images/footer-bg.webp',
  ],
  
  // Preload thresholds
  THRESHOLDS: {
    VIEWPORT_DISTANCE: 200, // pixels
    IDLE_TIMEOUT: 2000, // milliseconds
    INTERACTION_DELAY: 100, // milliseconds
  },
};

/**
 * Resource Preloader Class
 */
export class ResourcePreloader {
  private static instance: ResourcePreloader;
  private preloadedResources: Set<string> = new Set();
  private intersectionObserver?: IntersectionObserver;
  private idleCallback?: number;
  private isEnabled: boolean = true;

  private constructor() {
    this.initializePreloader();
  }

  public static getInstance(): ResourcePreloader {
    if (!ResourcePreloader.instance) {
      ResourcePreloader.instance = new ResourcePreloader();
    }
    return ResourcePreloader.instance;
  }

  /**
   * Initialize the preloader
   */
  private initializePreloader(): void {
    if (typeof window === 'undefined') return;

    // Preload critical resources immediately
    this.preloadCriticalResources();
    
    // Set up intersection observer for viewport-based preloading
    this.setupIntersectionObserver();
    
    // Set up idle preloading
    this.setupIdlePreloading();
    
    // Set up interaction-based preloading
    this.setupInteractionPreloading();
  }

  /**
   * Preload critical resources immediately
   */
  private preloadCriticalResources(): void {
    PRELOAD_CONFIG.CRITICAL_RESOURCES.forEach(resource => {
      this.preloadResource(resource, 'high');
    });
  }

  /**
   * Set up intersection observer for viewport-based preloading
   */
  private setupIntersectionObserver(): void {
    if (!('IntersectionObserver' in window)) return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            const preloadSrc = element.dataset.preload;
            
            if (preloadSrc) {
              this.preloadResource(preloadSrc, 'medium');
              this.intersectionObserver?.unobserve(element);
            }
          }
        });
      },
      {
        rootMargin: `${PRELOAD_CONFIG.THRESHOLDS.VIEWPORT_DISTANCE}px`,
      }
    );
  }

  /**
   * Set up idle preloading
   */
  private setupIdlePreloading(): void {
    if (typeof window === 'undefined') return;

    const preloadOnIdle = () => {
      PRELOAD_CONFIG.IDLE_RESOURCES.forEach(resource => {
        this.preloadResource(resource, 'low');
      });
    };

    // Use requestIdleCallback if available, otherwise use setTimeout
    if ('requestIdleCallback' in window) {
      this.idleCallback = requestIdleCallback(preloadOnIdle, {
        timeout: PRELOAD_CONFIG.THRESHOLDS.IDLE_TIMEOUT,
      });
    } else {
      setTimeout(preloadOnIdle, PRELOAD_CONFIG.THRESHOLDS.IDLE_TIMEOUT);
    }
  }

  /**
   * Set up interaction-based preloading
   */
  private setupInteractionPreloading(): void {
    if (typeof window === 'undefined') return;

    const preloadOnInteraction = () => {
      PRELOAD_CONFIG.INTERACTION_RESOURCES.forEach(resource => {
        this.preloadResource(resource, 'medium');
      });
    };

    // Preload on user interactions
    const interactionEvents = ['mouseover', 'touchstart', 'focus'];
    const debouncedPreload = this.debounce(preloadOnInteraction, PRELOAD_CONFIG.THRESHOLDS.INTERACTION_DELAY);

    interactionEvents.forEach(event => {
      document.addEventListener(event, debouncedPreload, { once: true, passive: true });
    });
  }

  /**
   * Preload a resource
   */
  public preloadResource(url: string, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    if (!this.isEnabled || this.preloadedResources.has(url)) return;

    try {
      const optimizedUrl = cdnAssetManager.getAssetUrl(url);
      const link = document.createElement('link');
      
      link.rel = 'preload';
      link.href = optimizedUrl;
      link.fetchPriority = priority;
      
      // Set appropriate 'as' attribute based on file type
      const asAttribute = this.getAsAttribute(url);
      if (asAttribute) {
        link.as = asAttribute;
      }
      
      // Set crossorigin for external resources
      if (this.isExternalResource(optimizedUrl)) {
        link.crossOrigin = 'anonymous';
      }
      
      // Add to document head
      document.head.appendChild(link);
      
      // Track preloaded resources
      this.preloadedResources.add(url);
      
      // Optional: Remove preload link after loading to free up memory
      link.addEventListener('load', () => {
        setTimeout(() => {
          if (link.parentNode) {
            link.parentNode.removeChild(link);
          }
        }, 1000);
      });
      
    } catch (error) {
      console.warn('Failed to preload resource:', url, error);
    }
  }

  /**
   * Preload multiple resources
   */
  public preloadResources(urls: string[], priority: 'high' | 'medium' | 'low' = 'medium'): void {
    urls.forEach(url => this.preloadResource(url, priority));
  }

  /**
   * Preload images with responsive variants
   */
  public preloadResponsiveImage(src: string, sizes: number[] = [640, 1024, 1920]): void {
    if (!this.isEnabled) return;

    sizes.forEach(size => {
      const optimizedUrl = cdnAssetManager.getAssetUrl(src, {
        width: size,
        format: 'webp',
        quality: 85,
      });
      
      this.preloadResource(optimizedUrl, 'medium');
    });
  }

  /**
   * Preload fonts
   */
  public preloadFonts(fonts: FontPreloadConfig[]): void {
    if (!this.isEnabled) return;

    fonts.forEach(font => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = font.url;
      link.as = 'font';
      link.type = font.type || 'font/woff2';
      link.crossOrigin = 'anonymous';
      
      if (font.media) {
        link.media = font.media;
      }
      
      document.head.appendChild(link);
      this.preloadedResources.add(font.url);
    });
  }

  /**
   * Preload CSS
   */
  public preloadCSS(href: string, media?: string): void {
    if (!this.isEnabled || this.preloadedResources.has(href)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = 'style';
    
    if (media) {
      link.media = media;
    }
    
    // Create actual stylesheet link
    const actualLink = document.createElement('link');
    actualLink.rel = 'stylesheet';
    actualLink.href = href;
    if (media) {
      actualLink.media = media;
    }
    
    link.addEventListener('load', () => {
      document.head.appendChild(actualLink);
    });
    
    document.head.appendChild(link);
    this.preloadedResources.add(href);
  }

  /**
   * Preload JavaScript modules
   */
  public preloadModule(src: string, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    if (!this.isEnabled || this.preloadedResources.has(src)) return;

    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = src;
    link.fetchPriority = priority;
    
    document.head.appendChild(link);
    this.preloadedResources.add(src);
  }

  /**
   * Observe element for preloading
   */
  public observeElement(element: HTMLElement, preloadSrc: string): void {
    if (!this.intersectionObserver) return;
    
    element.dataset.preload = preloadSrc;
    this.intersectionObserver.observe(element);
  }

  /**
   * Preload based on user navigation patterns
   */
  public preloadByNavigation(routes: RoutePreloadConfig[]): void {
    if (!this.isEnabled) return;

    routes.forEach(route => {
      const links = document.querySelectorAll(`a[href="${route.path}"]`);
      
      links.forEach(link => {
        const preloadOnHover = () => {
          route.resources.forEach(resource => {
            this.preloadResource(resource, 'medium');
          });
        };
        
        link.addEventListener('mouseenter', preloadOnHover, { once: true });
        link.addEventListener('focus', preloadOnHover, { once: true });
      });
    });
  }

  /**
   * Utility methods
   */
  private getAsAttribute(url: string): string | null {
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(extension || '')) {
      return 'image';
    }
    if (['js', 'mjs'].includes(extension || '')) {
      return 'script';
    }
    if (['css'].includes(extension || '')) {
      return 'style';
    }
    if (['woff', 'woff2', 'ttf', 'otf'].includes(extension || '')) {
      return 'font';
    }
    if (['mp4', 'webm', 'ogg'].includes(extension || '')) {
      return 'video';
    }
    if (['mp3', 'wav', 'ogg'].includes(extension || '')) {
      return 'audio';
    }
    
    return null;
  }

  private isExternalResource(url: string): boolean {
    return url.startsWith('http') && !url.includes(window.location.hostname);
  }

  private debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
    let timeoutId: NodeJS.Timeout;
    return ((...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    }) as T;
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

  public getPreloadedResources(): string[] {
    return Array.from(this.preloadedResources);
  }

  public clearPreloadedResources(): void {
    this.preloadedResources.clear();
  }

  public destroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    if (this.idleCallback && 'cancelIdleCallback' in window) {
      cancelIdleCallback(this.idleCallback);
    }
    
    this.preloadedResources.clear();
  }
}

/**
 * React hook for resource preloading
 */
export function useResourcePreloader() {
  const preloader = ResourcePreloader.getInstance();
  
  return {
    preloadResource: (url: string, priority?: 'high' | 'medium' | 'low') => 
      preloader.preloadResource(url, priority),
    preloadResources: (urls: string[], priority?: 'high' | 'medium' | 'low') => 
      preloader.preloadResources(urls, priority),
    preloadResponsiveImage: (src: string, sizes?: number[]) => 
      preloader.preloadResponsiveImage(src, sizes),
    preloadFonts: (fonts: FontPreloadConfig[]) => 
      preloader.preloadFonts(fonts),
    preloadCSS: (href: string, media?: string) => 
      preloader.preloadCSS(href, media),
    preloadModule: (src: string, priority?: 'high' | 'medium' | 'low') => 
      preloader.preloadModule(src, priority),
    observeElement: (element: HTMLElement, preloadSrc: string) => 
      preloader.observeElement(element, preloadSrc),
    getPreloadedResources: () => preloader.getPreloadedResources(),
  };
}

/**
 * Preload strategy utilities
 */
export class PreloadStrategy {
  /**
   * Critical path preloading
   */
  public static criticalPath(resources: string[]): void {
    const preloader = ResourcePreloader.getInstance();
    preloader.preloadResources(resources, 'high');
  }

  /**
   * Above-the-fold preloading
   */
  public static aboveTheFold(images: string[]): void {
    const preloader = ResourcePreloader.getInstance();
    images.forEach(image => {
      preloader.preloadResponsiveImage(image);
    });
  }

  /**
   * Route-based preloading
   */
  public static routeBased(routes: RoutePreloadConfig[]): void {
    const preloader = ResourcePreloader.getInstance();
    preloader.preloadByNavigation(routes);
  }

  /**
   * Predictive preloading based on user behavior
   */
  public static predictive(userBehavior: UserBehaviorData): void {
    const preloader = ResourcePreloader.getInstance();
    
    // Preload likely next pages based on user behavior
    const likelyPages = userBehavior.likelyNextPages || [];
    likelyPages.forEach(page => {
      preloader.preloadResource(page.url, 'low');
    });
  }
}

/**
 * Generate preload links for server-side rendering
 */
export function generatePreloadLinks(resources: PreloadResource[]): string {
  return resources
    .map(resource => {
      const optimizedUrl = cdnAssetManager.getAssetUrl(resource.url, resource.options);
      const attrs = [
        `rel="preload"`,
        `href="${optimizedUrl}"`,
      ];
      
      if (resource.as) attrs.push(`as="${resource.as}"`);
      if (resource.type) attrs.push(`type="${resource.type}"`);
      if (resource.crossorigin) attrs.push(`crossorigin="${resource.crossorigin}"`);
      if (resource.media) attrs.push(`media="${resource.media}"`);
      if (resource.fetchPriority) attrs.push(`fetchpriority="${resource.fetchPriority}"`);
      
      return `<link ${attrs.join(' ')} />`;
    })
    .join('\n');
}

// Type definitions
export interface FontPreloadConfig {
  url: string;
  type?: string;
  media?: string;
}

export interface RoutePreloadConfig {
  path: string;
  resources: string[];
}

export interface UserBehaviorData {
  likelyNextPages?: { url: string; probability: number }[];
  preferredImageFormats?: string[];
  deviceType?: 'mobile' | 'tablet' | 'desktop';
}

export interface PreloadResource {
  url: string;
  as?: string;
  type?: string;
  crossorigin?: 'anonymous' | 'use-credentials';
  media?: string;
  fetchPriority?: 'high' | 'medium' | 'low';
  options?: {
    width?: number;
    height?: number;
    format?: string;
    quality?: number;
  };
}

// Singleton instance
export const resourcePreloader = ResourcePreloader.getInstance();