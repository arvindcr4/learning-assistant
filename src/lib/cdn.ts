/**
 * CDN Integration and Asset Management Utilities
 * 
 * This module provides utilities for managing CDN integration,
 * asset optimization, and performance enhancement.
 */

import { env } from './env-validation';

// CDN Configuration
export const CDN_CONFIG = {
  // CloudFlare CDN settings
  CLOUDFLARE: {
    ZONE_ID: env.CLOUDFLARE_ZONE_ID || '',
    API_TOKEN: env.CLOUDFLARE_API_TOKEN || '',
    DOMAIN: env.CLOUDFLARE_DOMAIN || '',
    CACHE_TTL: {
      STATIC: 31536000, // 1 year for static assets
      DYNAMIC: 300, // 5 minutes for dynamic content
      API: 60, // 1 minute for API responses
      IMAGES: 2592000, // 30 days for images
      FONTS: 31536000, // 1 year for fonts
    },
    FEATURES: {
      BROTLI: true,
      HTTP2: true,
      IPV6: true,
      MINIFY: true,
      POLISH: true, // Image optimization
      MIRAGE: true, // Automatic image optimization
      ROCKET_LOADER: false, // Disable for better control
    },
  },
  
  // AWS CloudFront settings (alternative)
  CLOUDFRONT: {
    DISTRIBUTION_ID: env.CLOUDFRONT_DISTRIBUTION_ID || '',
    DOMAIN: env.CLOUDFRONT_DOMAIN || '',
    REGION: env.AWS_REGION || 'us-east-1',
    CACHE_TTL: {
      STATIC: 31536000,
      DYNAMIC: 300,
      API: 60,
      IMAGES: 2592000,
      FONTS: 31536000,
    },
    FEATURES: {
      GZIP: true,
      BROTLI: true,
      HTTP2: true,
      IPV6: true,
      ORIGIN_SHIELD: true,
    },
  },
  
  // Asset optimization settings
  OPTIMIZATION: {
    IMAGE_QUALITY: 85,
    WEBP_QUALITY: 80,
    AVIF_QUALITY: 75,
    COMPRESSION_LEVEL: 9,
    LAZY_LOAD_THRESHOLD: 100, // pixels
    CRITICAL_RESOURCE_HINT: true,
    PRELOAD_FONTS: true,
    PREFETCH_ASSETS: true,
    BUNDLE_SPLITTING: true,
    TREE_SHAKING: true,
  },
  
  // Performance budgets
  PERFORMANCE_BUDGETS: {
    INITIAL_BUNDLE_SIZE: 500 * 1024, // 500KB
    TOTAL_BUNDLE_SIZE: 2 * 1024 * 1024, // 2MB
    IMAGE_SIZE_LIMIT: 1024 * 1024, // 1MB
    FONT_SIZE_LIMIT: 100 * 1024, // 100KB
    CRITICAL_CSS_SIZE: 14 * 1024, // 14KB
    LCP_THRESHOLD: 2500, // 2.5 seconds
    FID_THRESHOLD: 100, // 100ms
    CLS_THRESHOLD: 0.1,
  },
};

// Asset URL generation
export class CDNAssetManager {
  private static instance: CDNAssetManager;
  private cdnDomain: string;
  private isProduction: boolean;

  private constructor() {
    this.cdnDomain = process.env.CDN_DOMAIN || '';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  public static getInstance(): CDNAssetManager {
    if (!CDNAssetManager.instance) {
      CDNAssetManager.instance = new CDNAssetManager();
    }
    return CDNAssetManager.instance;
  }

  /**
   * Generate optimized asset URL with CDN
   */
  public getAssetUrl(path: string, options: AssetOptions = {}): string {
    const {
      version = 'v1',
      format = 'auto',
      quality = 'auto',
      width,
      height,
      fit = 'cover',
      cacheBust = false,
    } = options;

    // Use CDN in production, local assets in development
    if (!this.isProduction || !this.cdnDomain) {
      return this.getLocalAssetUrl(path, cacheBust);
    }

    const baseUrl = `https://${this.cdnDomain}`;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // Build query parameters for image optimization
    const params = new URLSearchParams();
    
    if (format !== 'auto') params.append('format', format);
    if (quality !== 'auto') params.append('quality', quality.toString());
    if (width) params.append('w', width.toString());
    if (height) params.append('h', height.toString());
    if (fit !== 'cover') params.append('fit', fit);
    if (version !== 'v1') params.append('v', version);
    if (cacheBust) params.append('cb', Date.now().toString());

    const queryString = params.toString();
    return `${baseUrl}${normalizedPath}${queryString ? `?${queryString}` : ''}`;
  }

  /**
   * Generate local asset URL with cache busting
   */
  private getLocalAssetUrl(path: string, cacheBust: boolean): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (cacheBust) {
      const separator = normalizedPath.includes('?') ? '&' : '?';
      return `${normalizedPath}${separator}cb=${Date.now()}`;
    }
    return normalizedPath;
  }

  /**
   * Generate responsive image URLs for different screen sizes
   */
  public getResponsiveImageUrls(path: string, options: ResponsiveImageOptions = {}): ResponsiveImageUrls {
    const {
      sizes = [320, 640, 768, 1024, 1280, 1920],
      format = 'auto',
      quality = 85,
      fit = 'cover',
    } = options;

    const urls: ResponsiveImageUrls = {};
    
    sizes.forEach(size => {
      urls[`${size}w`] = this.getAssetUrl(path, {
        width: size,
        format,
        quality,
        fit,
      });
    });

    return urls;
  }

  /**
   * Generate preload links for critical resources
   */
  public generatePreloadLinks(assets: PreloadAsset[]): string[] {
    return assets.map(asset => {
      const url = this.getAssetUrl(asset.path, asset.options);
      const attrs = [
        `rel="preload"`,
        `href="${url}"`,
        `as="${asset.as}"`,
      ];

      if (asset.type) attrs.push(`type="${asset.type}"`);
      if (asset.crossorigin) attrs.push(`crossorigin="${asset.crossorigin}"`);
      if (asset.media) attrs.push(`media="${asset.media}"`);

      return `<link ${attrs.join(' ')} />`;
    });
  }

  /**
   * Generate optimal image srcset for responsive images
   */
  public generateSrcSet(path: string, options: ResponsiveImageOptions = {}): string {
    const urls = this.getResponsiveImageUrls(path, options);
    return Object.entries(urls)
      .map(([size, url]) => `${url} ${size}`)
      .join(', ');
  }
}

// Cache management utilities
export class CDNCacheManager {
  private static instance: CDNCacheManager;

  private constructor() {}

  public static getInstance(): CDNCacheManager {
    if (!CDNCacheManager.instance) {
      CDNCacheManager.instance = new CDNCacheManager();
    }
    return CDNCacheManager.instance;
  }

  /**
   * Purge CDN cache for specific paths
   */
  public async purgeCache(paths: string[]): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log('CDN cache purge (dev mode):', paths);
      return;
    }

    try {
      // CloudFlare cache purge
      if (CDN_CONFIG.CLOUDFLARE.API_TOKEN && CDN_CONFIG.CLOUDFLARE.ZONE_ID) {
        await this.purgeCloudflareCache(paths);
      }
      
      // Add other CDN providers as needed
    } catch (error) {
      console.error('CDN cache purge failed:', error);
    }
  }

  /**
   * Purge CloudFlare cache
   */
  private async purgeCloudflareCache(paths: string[]): Promise<void> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CDN_CONFIG.CLOUDFLARE.ZONE_ID}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CDN_CONFIG.CLOUDFLARE.API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: paths.map(path => `https://${CDN_CONFIG.CLOUDFLARE.DOMAIN}${path}`),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`CloudFlare cache purge failed: ${response.statusText}`);
    }
  }

  /**
   * Get cache headers for different asset types
   */
  public getCacheHeaders(assetType: AssetType): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (assetType) {
      case 'static':
        headers['Cache-Control'] = `public, max-age=${CDN_CONFIG.CLOUDFLARE.CACHE_TTL.STATIC}, immutable`;
        headers['Expires'] = new Date(Date.now() + CDN_CONFIG.CLOUDFLARE.CACHE_TTL.STATIC * 1000).toUTCString();
        break;
      
      case 'dynamic':
        headers['Cache-Control'] = `public, max-age=${CDN_CONFIG.CLOUDFLARE.CACHE_TTL.DYNAMIC}, s-maxage=${CDN_CONFIG.CLOUDFLARE.CACHE_TTL.DYNAMIC}`;
        break;
      
      case 'api':
        headers['Cache-Control'] = `public, max-age=${CDN_CONFIG.CLOUDFLARE.CACHE_TTL.API}, s-maxage=${CDN_CONFIG.CLOUDFLARE.CACHE_TTL.API}`;
        break;
      
      default:
        headers['Cache-Control'] = 'no-cache';
    }

    return headers;
  }
}

// Performance monitoring utilities
export class CDNPerformanceMonitor {
  private static instance: CDNPerformanceMonitor;
  private metrics: PerformanceMetric[] = [];

  private constructor() {}

  public static getInstance(): CDNPerformanceMonitor {
    if (!CDNPerformanceMonitor.instance) {
      CDNPerformanceMonitor.instance = new CDNPerformanceMonitor();
    }
    return CDNPerformanceMonitor.instance;
  }

  /**
   * Track asset loading performance
   */
  public trackAssetLoad(url: string, startTime: number, endTime: number): void {
    const metric: PerformanceMetric = {
      url,
      duration: endTime - startTime,
      timestamp: Date.now(),
      type: this.getAssetType(url),
    };

    this.metrics.push(metric);
    this.cleanupOldMetrics();
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): PerformanceStats {
    const total = this.metrics.length;
    const durations = this.metrics.map(m => m.duration);
    
    return {
      total,
      averageLoadTime: durations.reduce((sum, d) => sum + d, 0) / total || 0,
      p95LoadTime: this.getPercentile(durations, 0.95),
      p99LoadTime: this.getPercentile(durations, 0.99),
      cacheHitRate: this.calculateCacheHitRate(),
    };
  }

  private getAssetType(url: string): AssetType {
    if (url.includes('/api/')) return 'api';
    if (url.match(/\.(js|css|woff|woff2|svg)$/)) return 'static';
    return 'dynamic';
  }

  private getPercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[index] || 0;
  }

  private calculateCacheHitRate(): number {
    // This would be implemented with actual cache hit/miss tracking
    return 0.85; // Placeholder
  }

  private cleanupOldMetrics(): void {
    const oneHourAgo = Date.now() - 3600000;
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
  }
}

// Type definitions
export interface AssetOptions {
  version?: string;
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
  quality?: number | 'auto';
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  cacheBust?: boolean;
}

export interface ResponsiveImageOptions {
  sizes?: number[];
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
  quality?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface ResponsiveImageUrls {
  [key: string]: string;
}

export interface PreloadAsset {
  path: string;
  as: 'script' | 'style' | 'image' | 'font' | 'fetch';
  type?: string;
  crossorigin?: 'anonymous' | 'use-credentials';
  media?: string;
  options?: AssetOptions;
}

export type AssetType = 'static' | 'dynamic' | 'api';

export interface PerformanceMetric {
  url: string;
  duration: number;
  timestamp: number;
  type: AssetType;
}

export interface PerformanceStats {
  total: number;
  averageLoadTime: number;
  p95LoadTime: number;
  p99LoadTime: number;
  cacheHitRate: number;
}

// Singleton instances
export const cdnAssetManager = CDNAssetManager.getInstance();
export const cdnCacheManager = CDNCacheManager.getInstance();
export const cdnPerformanceMonitor = CDNPerformanceMonitor.getInstance();