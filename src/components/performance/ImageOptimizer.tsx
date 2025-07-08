/**
 * Advanced Image Optimizer Component
 * 
 * Provides intelligent image optimization with WebP/AVIF support,
 * lazy loading, responsive images, and performance monitoring.
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cdnManager } from '../../lib/cdn';
import { performanceMonitor } from '../../lib/performance';

// Image format preferences
const IMAGE_FORMATS = {
  AVIF: 'image/avif',
  WEBP: 'image/webp',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
} as const;

// Device pixel ratio breakpoints
const DPR_BREAKPOINTS = [1, 1.5, 2, 3];

// Default responsive breakpoints
const DEFAULT_BREAKPOINTS = [320, 640, 768, 1024, 1280, 1920];

export interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  lazy?: boolean;
  quality?: number;
  placeholder?: 'blur' | 'empty' | string;
  sizes?: string;
  breakpoints?: number[];
  formats?: string[];
  onLoad?: () => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: React.CSSProperties;
  fallback?: string;
}

export interface ResponsiveImageSource {
  srcSet: string;
  sizes: string;
  type: string;
}

/**
 * Optimized Image Component with advanced features
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  priority = false,
  lazy = true,
  quality = 80,
  placeholder = 'empty',
  sizes,
  breakpoints = DEFAULT_BREAKPOINTS,
  formats = ['avif', 'webp', 'jpg'],
  onLoad,
  onError,
  className,
  style,
  fallback,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(!lazy || priority);
  const [error, setError] = useState<string | null>(null);
  const [currentFormat, setCurrentFormat] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Detect browser format support
  const [supportedFormats, setSupportedFormats] = useState<Set<string>>(new Set());

  useEffect(() => {
    detectFormatSupport().then(setSupportedFormats);
  }, []);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || priority) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1,
      }
    );

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [lazy, priority]);

  // Generate responsive image sources
  const imageSources = useCallback((): ResponsiveImageSource[] => {
    if (!isInView) return [];

    const sources: ResponsiveImageSource[] = [];
    const filteredFormats = formats.filter(format => 
      supportedFormats.has(getFormatMimeType(format))
    );

    filteredFormats.forEach(format => {
      const srcSet = breakpoints
        .flatMap(breakpoint => 
          DPR_BREAKPOINTS.map(dpr => {
            const actualWidth = breakpoint * dpr;
            const url = cdnManager.getAssetUrl(src, {
              width: actualWidth,
              height: height ? Math.round((height / (width || actualWidth)) * actualWidth) : undefined,
              format: format as any,
              quality,
            });
            return `${url} ${actualWidth}w`;
          })
        )
        .join(', ');

      sources.push({
        srcSet,
        sizes: sizes || `(max-width: ${Math.max(...breakpoints)}px) 100vw, ${Math.max(...breakpoints)}px`,
        type: getFormatMimeType(format),
      });
    });

    return sources;
  }, [src, width, height, quality, sizes, breakpoints, formats, supportedFormats, isInView]);

  // Generate fallback image URL
  const fallbackSrc = useCallback(() => {
    if (fallback) return fallback;
    if (!isInView) return '';

    return cdnManager.getAssetUrl(src, {
      width: width || Math.max(...breakpoints),
      height,
      format: 'jpg',
      quality,
    });
  }, [src, width, height, quality, fallback, breakpoints, isInView]);

  // Handle image load
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setError(null);
    
    // Track performance metrics
    if (imgRef.current) {
      const img = imgRef.current;
      performanceMonitor.trackAssetLoad(img.src, 0, performance.now());
    }
    
    onLoad?.();
  }, [onLoad]);

  // Handle image error
  const handleError = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const errorMsg = `Failed to load image: ${img.src}`;
    setError(errorMsg);
    
    const error = new Error(errorMsg);
    onError?.(error);
    
    // Try fallback formats
    if (currentFormat !== 'jpg') {
      setCurrentFormat('jpg');
    }
  }, [onError, currentFormat]);

  // Preload critical images
  useEffect(() => {
    if (priority && typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = fallbackSrc();
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [priority, fallbackSrc]);

  // Generate placeholder
  const renderPlaceholder = () => {
    if (placeholder === 'empty') return null;
    
    if (placeholder === 'blur') {
      return (
        <div
          className={`absolute inset-0 bg-gray-200 animate-pulse ${className}`}
          style={{
            ...style,
            filter: 'blur(5px)',
            transform: 'scale(1.1)',
          }}
        />
      );
    }

    if (typeof placeholder === 'string') {
      return (
        <img
          src={placeholder}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover ${className}`}
          style={{
            ...style,
            filter: 'blur(5px)',
          }}
        />
      );
    }

    return null;
  };

  if (error && !fallback) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 text-gray-500 ${className}`}
        style={{ width, height, ...style }}
      >
        <span>Image failed to load</span>
      </div>
    );
  }

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ width, height, ...style }}
    >
      {!isLoaded && renderPlaceholder()}
      
      {isInView && (
        <picture>
          {imageSources().map((source, index) => (
            <source
              key={index}
              srcSet={source.srcSet}
              sizes={source.sizes}
              type={source.type}
            />
          ))}
          <img
            ref={imgRef}
            src={fallbackSrc()}
            alt={alt}
            width={width}
            height={height}
            loading={lazy && !priority ? 'lazy' : 'eager'}
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              aspectRatio: width && height ? `${width}/${height}` : undefined,
            }}
          />
        </picture>
      )}
    </div>
  );
};

/**
 * Image Gallery Component with optimization
 */
export interface ImageGalleryProps {
  images: Array<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }>;
  columns?: number;
  gap?: number;
  lazy?: boolean;
  quality?: number;
  className?: string;
}

export const OptimizedImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  columns = 3,
  gap = 16,
  lazy = true,
  quality = 80,
  className,
}) => {
  const [visibleImages, setVisibleImages] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Implement progressive image loading
  useEffect(() => {
    if (!lazy) {
      setVisibleImages(new Set(images.map((_, index) => index)));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0', 10);
            setVisibleImages(prev => new Set([...prev, index]));
          }
        });
      },
      {
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    const imageElements = containerRef.current?.querySelectorAll('[data-index]');
    imageElements?.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [images, lazy]);

  return (
    <div
      ref={containerRef}
      className={`grid ${className}`}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {images.map((image, index) => (
        <div
          key={index}
          data-index={index}
          className="aspect-square"
        >
          {(visibleImages.has(index) || !lazy) && (
            <OptimizedImage
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              lazy={lazy}
              quality={quality}
              className="w-full h-full rounded-lg"
            />
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * Utility functions
 */

async function detectFormatSupport(): Promise<Set<string>> {
  const supported = new Set<string>();

  // Test AVIF support
  if (await testImageFormat('data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=')) {
    supported.add(IMAGE_FORMATS.AVIF);
  }

  // Test WebP support
  if (await testImageFormat('data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA')) {
    supported.add(IMAGE_FORMATS.WEBP);
  }

  // JPEG and PNG are universally supported
  supported.add(IMAGE_FORMATS.JPEG);
  supported.add(IMAGE_FORMATS.PNG);

  return supported;
}

function testImageFormat(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

function getFormatMimeType(format: string): string {
  switch (format.toLowerCase()) {
    case 'avif':
      return IMAGE_FORMATS.AVIF;
    case 'webp':
      return IMAGE_FORMATS.WEBP;
    case 'jpg':
    case 'jpeg':
      return IMAGE_FORMATS.JPEG;
    case 'png':
      return IMAGE_FORMATS.PNG;
    default:
      return IMAGE_FORMATS.JPEG;
  }
}

/**
 * Image optimization hook
 */
export function useImageOptimization() {
  const [formatSupport, setFormatSupport] = useState<Set<string>>(new Set());
  const [loadingStats, setLoadingStats] = useState({
    totalImages: 0,
    loadedImages: 0,
    failedImages: 0,
    averageLoadTime: 0,
  });

  useEffect(() => {
    detectFormatSupport().then(setFormatSupport);
  }, []);

  const trackImageLoad = useCallback((loadTime: number, success: boolean) => {
    setLoadingStats(prev => ({
      totalImages: prev.totalImages + 1,
      loadedImages: success ? prev.loadedImages + 1 : prev.loadedImages,
      failedImages: success ? prev.failedImages : prev.failedImages + 1,
      averageLoadTime: (prev.averageLoadTime * prev.totalImages + loadTime) / (prev.totalImages + 1),
    }));
  }, []);

  const getOptimalFormat = useCallback((formats: string[] = ['avif', 'webp', 'jpg']) => {
    return formats.find(format => formatSupport.has(getFormatMimeType(format))) || 'jpg';
  }, [formatSupport]);

  const generateResponsiveSrcSet = useCallback((
    src: string,
    breakpoints: number[] = DEFAULT_BREAKPOINTS,
    format: string = 'jpg',
    quality: number = 80
  ) => {
    return breakpoints
      .flatMap(breakpoint => 
        DPR_BREAKPOINTS.map(dpr => {
          const actualWidth = breakpoint * dpr;
          const url = cdnManager.getAssetUrl(src, {
            width: actualWidth,
            format: format as any,
            quality,
          });
          return `${url} ${actualWidth}w`;
        })
      )
      .join(', ');
  }, []);

  return {
    formatSupport,
    loadingStats,
    trackImageLoad,
    getOptimalFormat,
    generateResponsiveSrcSet,
  };
}

export default OptimizedImage;