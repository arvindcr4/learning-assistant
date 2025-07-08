/**
 * Optimized Image Component
 * 
 * A high-performance image component with lazy loading,
 * responsive images, and progressive enhancement.
 */

'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { cdnAssetManager } from '@/lib/cdn';
import { resourcePreloader } from '@/lib/preload';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
  sizes?: string;
  fill?: boolean;
  loading?: 'lazy' | 'eager';
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  responsive?: boolean;
  lazyLoadOffset?: number;
  enablePreload?: boolean;
  preloadSizes?: number[];
  fallbackSrc?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
  style?: React.CSSProperties;
  unoptimized?: boolean;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 85,
  format = 'auto',
  sizes,
  fill = false,
  loading = 'lazy',
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onError,
  responsive = true,
  lazyLoadOffset = 100,
  enablePreload = false,
  preloadSizes = [640, 1024, 1920],
  fallbackSrc,
  objectFit = 'cover',
  objectPosition = 'center',
  style,
  unoptimized = false,
  ...rest
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isInView, setIsInView] = useState(priority);

  // Generate optimized image URL
  const optimizedSrc = unoptimized 
    ? src 
    : cdnAssetManager.getAssetUrl(src, {
        width,
        height,
        format,
        quality,
        fit: objectFit,
      });

  // Generate responsive image URLs
  const responsiveUrls = responsive && !unoptimized
    ? cdnAssetManager.getResponsiveImageUrls(src, {
        format,
        quality,
        fit: objectFit,
      })
    : {};

  // Generate srcSet for responsive images
  const srcSet = responsive && !unoptimized
    ? cdnAssetManager.generateSrcSet(src, {
        format,
        quality,
        fit: objectFit,
      })
    : undefined;

  // Generate blur placeholder
  const blurPlaceholder = useMemo(() => {
    if (blurDataURL) return blurDataURL;
    if (placeholder === 'blur' && !unoptimized) {
      return cdnAssetManager.getAssetUrl(src, {
        width: 8,
        height: 8,
        quality: 10,
        format: 'jpeg',
      });
    }
    return undefined;
  }, [blurDataURL, placeholder, src, unoptimized]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || loading === 'eager') {
      setIsInView(true);
      return;
    }

    if (!('IntersectionObserver' in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: `${lazyLoadOffset}px`,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority, loading, lazyLoadOffset]);

  // Preload responsive images
  useEffect(() => {
    if (enablePreload && priority) {
      resourcePreloader.preloadResponsiveImage(src, preloadSizes);
    }
  }, [enablePreload, priority, src, preloadSizes]);

  // Handle load event
  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  // Handle error event
  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setHasError(false);
    } else {
      setHasError(true);
      onError?.();
    }
  };

  // Determine sizes attribute
  const sizesAttribute = sizes || (responsive ? 
    '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw' : 
    undefined);

  // Base props for Next.js Image component
  const baseProps = {
    ref: imgRef,
    alt,
    className: `${className} ${isLoaded ? 'loaded' : 'loading'} ${hasError ? 'error' : ''}`,
    priority,
    quality,
    sizes: sizesAttribute,
    loading,
    placeholder,
    blurDataURL: blurPlaceholder,
    onLoad: handleLoad,
    onError: handleError,
    style: {
      objectFit,
      objectPosition,
      ...style,
    },
    unoptimized,
    ...rest,
  };

  // Render placeholder while not in view
  if (!isInView) {
    return (
      <div
        ref={imgRef}
        className={`${className} placeholder`}
        style={{
          width: fill ? '100%' : width,
          height: fill ? '100%' : height,
          backgroundColor: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
        aria-label={`Loading ${alt}`}
      >
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Render error state
  if (hasError) {
    return (
      <div
        className={`${className} error-state`}
        style={{
          width: fill ? '100%' : width,
          height: fill ? '100%' : height,
          backgroundColor: '#fee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#c53030',
          ...style,
        }}
        aria-label={`Failed to load ${alt}`}
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  // Render with fill prop
  if (fill) {
    return (
      <Image
        {...baseProps}
        src={unoptimized ? currentSrc : optimizedSrc}
        fill
      />
    );
  }

  // Render with fixed dimensions
  if (width && height) {
    return (
      <Image
        {...baseProps}
        src={unoptimized ? currentSrc : optimizedSrc}
        width={width}
        height={height}
        srcSet={srcSet}
      />
    );
  }

  // Render with responsive behavior
  return (
    <Image
      {...baseProps}
      src={unoptimized ? currentSrc : optimizedSrc}
      width={width || 1920}
      height={height || 1080}
      srcSet={srcSet}
    />
  );
}

// Gallery component for multiple optimized images
interface ImageGalleryProps {
  images: Array<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
    caption?: string;
  }>;
  className?: string;
  columns?: number;
  gap?: string;
  lazyLoad?: boolean;
  enablePreload?: boolean;
}

export function ImageGallery({
  images,
  className = '',
  columns = 3,
  gap = '1rem',
  lazyLoad = true,
  enablePreload = false,
}: ImageGalleryProps) {
  const [loadedCount, setLoadedCount] = useState(0);

  const handleImageLoad = () => {
    setLoadedCount(prev => prev + 1);
  };

  return (
    <div
      className={`image-gallery ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
      }}
    >
      {images.map((image, index) => (
        <div key={index} className="image-gallery-item">
          <OptimizedImage
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            className="w-full h-auto"
            loading={lazyLoad ? 'lazy' : 'eager'}
            enablePreload={enablePreload && index < 3} // Preload first 3 images
            onLoad={handleImageLoad}
            responsive
          />
          {image.caption && (
            <p className="mt-2 text-sm text-gray-600">{image.caption}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// Hero image component with optimizations
interface HeroImageProps {
  src: string;
  alt: string;
  className?: string;
  overlay?: boolean;
  overlayOpacity?: number;
  children?: React.ReactNode;
}

export function HeroImage({
  src,
  alt,
  className = '',
  overlay = false,
  overlayOpacity = 0.5,
  children,
}: HeroImageProps) {
  return (
    <div className={`relative ${className}`}>
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        priority
        quality={90}
        format="webp"
        className="object-cover"
        sizes="100vw"
        enablePreload
        preloadSizes={[1920, 1280, 640]}
      />
      {overlay && (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />
      )}
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

// Avatar component with optimizations
interface AvatarProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallback?: string;
}

export function Avatar({
  src,
  alt,
  size = 'md',
  className = '',
  fallback,
}: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const sizePixels = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  };

  return (
    <div className={`${sizeClasses[size]} ${className} relative overflow-hidden rounded-full`}>
      <OptimizedImage
        src={src}
        alt={alt}
        width={sizePixels[size]}
        height={sizePixels[size]}
        className="object-cover"
        quality={90}
        format="webp"
        fallbackSrc={fallback}
        placeholder="blur"
      />
    </div>
  );
}

// Thumbnail component with optimizations
interface ThumbnailProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  onClick?: () => void;
  loading?: 'lazy' | 'eager';
}

export function Thumbnail({
  src,
  alt,
  width = 200,
  height = 200,
  className = '',
  onClick,
  loading = 'lazy',
}: ThumbnailProps) {
  return (
    <div
      className={`thumbnail ${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="object-cover rounded-lg transition-transform hover:scale-105"
        quality={80}
        format="webp"
        loading={loading}
        placeholder="blur"
      />
    </div>
  );
}

// Progressive image component
interface ProgressiveImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  lowQualitySrc?: string;
}

export function ProgressiveImage({
  src,
  alt,
  width,
  height,
  className = '',
  lowQualitySrc,
}: ProgressiveImageProps) {
  const [isHighQualityLoaded, setIsHighQualityLoaded] = useState(false);

  const lowQualityUrl = lowQualitySrc || cdnAssetManager.getAssetUrl(src, {
    width: Math.round(width * 0.1),
    height: Math.round(height * 0.1),
    quality: 20,
    format: 'jpeg',
  });

  const highQualityUrl = cdnAssetManager.getAssetUrl(src, {
    width,
    height,
    quality: 85,
    format: 'webp',
  });

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* Low quality placeholder */}
      <OptimizedImage
        src={lowQualityUrl}
        alt={alt}
        width={width}
        height={height}
        className={`absolute inset-0 object-cover transition-opacity duration-300 ${
          isHighQualityLoaded ? 'opacity-0' : 'opacity-100'
        }`}
        unoptimized
        priority
      />
      
      {/* High quality image */}
      <OptimizedImage
        src={highQualityUrl}
        alt={alt}
        width={width}
        height={height}
        className={`absolute inset-0 object-cover transition-opacity duration-300 ${
          isHighQualityLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setIsHighQualityLoaded(true)}
        unoptimized
        loading="lazy"
      />
    </div>
  );
}

export default OptimizedImage;