'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';

import { useDebounce as useDebounceHook } from './useDebounce';

// Hook for debounced values (local implementation)
function useLocalDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Hook for throttled functions
export function useThrottle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  const lastCall = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall.current;

    if (timeSinceLastCall >= delay) {
      lastCall.current = now;
      return func(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        lastCall.current = Date.now();
        func(...args);
      }, delay - timeSinceLastCall);
    }
  }, [func, delay]) as T;
}

// Hook for memoized expensive computations
export function useMemoizedComputation<T>(
  computation: () => T,
  dependencies: any[]
): T {
  return useMemo(computation, dependencies);
}

// Hook for lazy initialization
export function useLazyInitialization<T>(
  initializer: () => T
): T {
  const [value] = useState(initializer);
  return value;
}

// Hook for virtual scrolling
export function useVirtualScroll<T>(
  items: T[],
  containerHeight: number,
  itemHeight: number,
  buffer: number = 5
): {
  visibleItems: T[];
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetY: number;
} {
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
  };
}

// Hook for intersection observer
export function useIntersectionObserver(
  targetRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
): IntersectionObserverEntry | null {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(([entry]) => {
      setEntry(entry);
    }, options);

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [targetRef, options]);

  return entry;
}

// Hook for performance monitoring with better error handling
export function usePerformanceMonitor(): {
  startMeasure: (name: string) => void;
  endMeasure: (name: string) => number | null;
  getMetrics: () => PerformanceMetrics;
} {
  const metricsRef = useRef<PerformanceMetrics>({
    renderTimes: [],
    interactionTimes: [],
    memoryUsage: [],
    apiCallTimes: [],
  });

  const startMeasure = useCallback((name: string) => {
    try {
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark(`${name}-start`);
      }
    } catch (error) {
      console.warn('Performance measurement not available:', error);
    }
  }, []);

  const endMeasure = useCallback((name: string) => {
    try {
      if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
        performance.mark(`${name}-end`);
        performance.measure(name, `${name}-start`, `${name}-end`);
        
        const measures = performance.getEntriesByName(name, 'measure');
        if (measures.length > 0) {
          return measures[0]?.duration ?? null;
        }
      }
    } catch (error) {
      console.warn('Performance measurement failed:', error);
    }
    return null;
  }, []);

  const getMetrics = useCallback(() => {
    try {
      // Update memory usage if available (Chrome only)
      if (typeof performance !== 'undefined' && 'memory' in performance) {
        const memInfo = (performance as any).memory;
        if (memInfo) {
          metricsRef.current.memoryUsage.push({
            used: memInfo.usedJSHeapSize,
            total: memInfo.totalJSHeapSize,
            limit: memInfo.jsHeapSizeLimit,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      console.warn('Memory monitoring not available:', error);
    }

    return { ...metricsRef.current };
  }, []);

  return { startMeasure, endMeasure, getMetrics };
}

interface PerformanceMetrics {
  renderTimes: number[];
  interactionTimes: number[];
  memoryUsage: Array<{
    used: number;
    total: number;
    limit: number;
    timestamp: number;
  }>;
  apiCallTimes: Array<{
    endpoint: string;
    duration: number;
    timestamp: number;
  }>;
}

// Hook for render performance tracking
export function useRenderPerformance(componentName: string): void {
  const { startMeasure, endMeasure } = usePerformanceMonitor();

  useEffect(() => {
    startMeasure(`${componentName}-render`);
    return () => {
      endMeasure(`${componentName}-render`);
    };
  }, [componentName, startMeasure, endMeasure]);
}

// Hook for batch updates
export function useBatchedUpdates<T>(): {
  batchedState: T[];
  addToBatch: (item: T) => void;
  processBatch: () => T[];
  clearBatch: () => void;
} {
  const [batchedState, setBatchedState] = useState<T[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const addToBatch = useCallback((item: T) => {
    setBatchedState(prev => [...prev, item]);
  }, []);

  const processBatch = useCallback(() => {
    const batch = batchedState;
    setBatchedState([]);
    return batch;
  }, [batchedState]);

  const clearBatch = useCallback(() => {
    setBatchedState([]);
  }, []);

  return { batchedState, addToBatch, processBatch, clearBatch };
}

// Hook for optimized re-renders
export function useOptimizedRerender(): {
  forceUpdate: () => void;
  renderCount: number;
} {
  const [renderCount, setRenderCount] = useState(0);

  const forceUpdate = useCallback(() => {
    setRenderCount(prev => prev + 1);
  }, []);

  return { forceUpdate, renderCount };
}

// Hook for component lifecycle tracking
export function useLifecycleTracker(componentName: string): void {
  useEffect(() => {
    console.log(`${componentName} mounted`);
    return () => {
      console.log(`${componentName} unmounted`);
    };
  }, [componentName]);

  useEffect(() => {
    console.log(`${componentName} updated`);
  });
}

// Hook for efficient list updates
export function useListOptimization<T>(
  items: T[],
  keyExtractor: (item: T) => string
): {
  optimizedItems: T[];
  addItem: (item: T) => void;
  removeItem: (key: string) => void;
  updateItem: (key: string, updates: Partial<T>) => void;
} {
  const [optimizedItems, setOptimizedItems] = useState<T[]>(items);
  const itemsMapRef = useRef<Map<string, T>>(new Map());

  // Update items map when items change
  useEffect(() => {
    itemsMapRef.current.clear();
    items.forEach(item => {
      itemsMapRef.current.set(keyExtractor(item), item);
    });
    setOptimizedItems(items);
  }, [items, keyExtractor]);

  const addItem = useCallback((item: T) => {
    const key = keyExtractor(item);
    itemsMapRef.current.set(key, item);
    setOptimizedItems(Array.from(itemsMapRef.current.values()));
  }, [keyExtractor]);

  const removeItem = useCallback((key: string) => {
    itemsMapRef.current.delete(key);
    setOptimizedItems(Array.from(itemsMapRef.current.values()));
  }, []);

  const updateItem = useCallback((key: string, updates: Partial<T>) => {
    const existingItem = itemsMapRef.current.get(key);
    if (existingItem) {
      const updatedItem = { ...existingItem, ...updates };
      itemsMapRef.current.set(key, updatedItem);
      setOptimizedItems(Array.from(itemsMapRef.current.values()));
    }
  }, []);

  return { optimizedItems, addItem, removeItem, updateItem };
}

// Hook for image lazy loading
export function useLazyImage(src: string): {
  imageSrc: string | null;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
} {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;

    setIsLoading(true);
    setError(null);

    const img = new Image();
    
    img.onload = () => {
      setImageSrc(src);
      setIsLoaded(true);
      setIsLoading(false);
    };

    img.onerror = () => {
      setError('Failed to load image');
      setIsLoading(false);
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { imageSrc, isLoaded, isLoading, error };
}

// Hook for efficient search
export function useSearchOptimization<T>(
  items: T[],
  searchTerm: string,
  searchKey: keyof T,
  debounceMs: number = 300
): {
  searchResults: T[];
  isSearching: boolean;
} {
  const [searchResults, setSearchResults] = useState<T[]>(items);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearchTerm = useLocalDebounce(searchTerm, debounceMs);

  useEffect(() => {
    if (!debouncedSearchTerm) {
      setSearchResults(items);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const results = items.filter(item => {
      const value = item[searchKey];
      if (typeof value === 'string') {
        return value.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      }
      return false;
    });

    setSearchResults(results);
    setIsSearching(false);
  }, [items, debouncedSearchTerm, searchKey]);

  return { searchResults, isSearching };
}