'use client';

import React, { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useRenderTracking } from '@/hooks/usePerformanceMonitoring';

// Enhanced memo with deep comparison options
interface MemoOptions {
  compareProps?: (prevProps: any, nextProps: any) => boolean;
  compareChildren?: boolean;
  trackRenders?: boolean;
  componentName?: string;
}

export function createOptimizedMemo<P extends object>(
  Component: React.ComponentType<P>,
  options: MemoOptions = {}
): React.ComponentType<P> {
  const {
    compareProps,
    compareChildren = false,
    trackRenders = false,
    componentName = Component.displayName || Component.name || 'Unknown'
  } = options;

  const areEqual = (prevProps: P, nextProps: P): boolean => {
    // Custom comparison if provided
    if (compareProps) {
      return compareProps(prevProps, nextProps);
    }

    // Default shallow comparison for props
    const prevKeys = Object.keys(prevProps);
    const nextKeys = Object.keys(nextProps);

    if (prevKeys.length !== nextKeys.length) {
      return false;
    }

    for (const key of prevKeys) {
      if (prevProps[key as keyof P] !== nextProps[key as keyof P]) {
        // Special handling for children if compareChildren is false
        if (key === 'children' && !compareChildren) {
          continue;
        }
        return false;
      }
    }

    return true;
  };

  const MemoizedComponent = memo(Component, areEqual);

  if (trackRenders) {
    const TrackedComponent = (props: P) => {
      useRenderTracking(componentName, props as Record<string, any>);
      return <MemoizedComponent {...props} />;
    };

    TrackedComponent.displayName = `Tracked(${componentName})`;
    return TrackedComponent;
  }

  MemoizedComponent.displayName = `Memo(${componentName})`;
  return MemoizedComponent;
}

// Deep comparison memo
export function createDeepMemo<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  return createOptimizedMemo(Component, {
    compareProps: (prevProps, nextProps) => {
      return JSON.stringify(prevProps) === JSON.stringify(nextProps);
    },
    componentName: componentName || Component.displayName || Component.name,
  });
}

// Shallow comparison memo (default React.memo behavior but with tracking)
export function createShallowMemo<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  return createOptimizedMemo(Component, {
    trackRenders: true,
    componentName: componentName || Component.displayName || Component.name,
  });
}

// Optimized callback hook with dependency analysis
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList,
  options: { debounce?: number; throttle?: number } = {}
): T {
  const { debounce, throttle } = options;
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCallTime = useRef(0);

  // Update callback ref
  callbackRef.current = callback;

  const optimizedCallback = useCallback((...args: any[]) => {
    const now = Date.now();

    // Throttling
    if (throttle && now - lastCallTime.current < throttle) {
      return;
    }

    // Debouncing
    if (debounce) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        lastCallTime.current = Date.now();
        return callbackRef.current(...args);
      }, debounce);
      return;
    }

    lastCallTime.current = now;
    return callbackRef.current(...args);
  }, deps) as T;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return optimizedCallback;
}

// Memoized value with custom equality
export function useOptimizedMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  equalityFn?: (prev: T, next: T) => boolean
): T {
  const [memoizedValue, setMemoizedValue] = useState<T>(factory);
  const depsRef = useRef(deps);
  const valueRef = useRef(memoizedValue);

  // Check if dependencies have changed
  const depsChanged = useMemo(() => {
    if (depsRef.current.length !== deps.length) {
      return true;
    }
    return deps.some((dep, index) => dep !== depsRef.current[index]);
  }, deps);

  // Recalculate if dependencies changed
  if (depsChanged) {
    const newValue = factory();
    
    // Use custom equality function if provided
    if (equalityFn && !equalityFn(valueRef.current, newValue)) {
      setMemoizedValue(newValue);
      valueRef.current = newValue;
    } else if (!equalityFn && newValue !== valueRef.current) {
      setMemoizedValue(newValue);
      valueRef.current = newValue;
    }
    
    depsRef.current = deps;
  }

  return memoizedValue;
}

// Component wrapper for render optimization
export function withRenderOptimization<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    memo?: boolean;
    trackRenders?: boolean;
    preventRerender?: (prevProps: P, nextProps: P) => boolean;
  } = {}
): React.ComponentType<P> {
  const { memo: useMemo = true, trackRenders = false, preventRerender } = options;

  let OptimizedComponent = Component;

  // Apply memo if requested
  if (useMemo) {
    OptimizedComponent = createOptimizedMemo(OptimizedComponent, {
      compareProps: preventRerender,
      trackRenders,
    });
  }

  return OptimizedComponent;
}

// Hook for conditional rendering
export function useConditionalRender<T>(
  condition: boolean,
  renderFn: () => T,
  deps: React.DependencyList = []
): T | null {
  return useMemo(() => {
    return condition ? renderFn() : null;
  }, [condition, ...deps]);
}

// Hook for lazy component loading
export function useLazyComponent<P extends object>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>,
  fallback?: React.ComponentNode
): React.ComponentType<P> | null {
  const [Component, setComponent] = useState<React.ComponentType<P> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    importFn()
      .then((module) => {
        setComponent(() => module.default);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load lazy component:', error);
        setLoading(false);
      });
  }, [importFn]);

  if (loading) {
    return () => fallback || <div>Loading...</div>;
  }

  return Component;
}

// Optimized list renderer
interface OptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  className?: string;
  itemHeight?: number;
  containerHeight?: number;
  virtualization?: boolean;
}

export function OptimizedList<T>({
  items,
  renderItem,
  keyExtractor,
  className,
  itemHeight = 50,
  containerHeight = 400,
  virtualization = false,
}: OptimizedListProps<T>): JSX.Element {
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useOptimizedCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop);
    },
    [],
    { throttle: 16 } // 60fps
  );

  const visibleItems = useMemo(() => {
    if (!virtualization || !itemHeight) {
      return items.map((item, index) => ({ item, index }));
    }

    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      items.length - 1,
      startIndex + Math.ceil(containerHeight / itemHeight) + 1
    );

    return items
      .slice(startIndex, endIndex + 1)
      .map((item, relativeIndex) => ({
        item,
        index: startIndex + relativeIndex,
      }));
  }, [items, virtualization, itemHeight, scrollTop, containerHeight]);

  const totalHeight = virtualization ? items.length * itemHeight : 'auto';
  const offsetY = virtualization ? Math.floor(scrollTop / itemHeight) * itemHeight : 0;

  return (
    <div
      className={className}
      style={{ 
        height: virtualization ? containerHeight : 'auto',
        overflow: virtualization ? 'auto' : 'visible'
      }}
      onScroll={virtualization ? handleScroll : undefined}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: virtualization ? 'absolute' : 'static',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map(({ item, index }) => (
            <div key={keyExtractor(item, index)}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// HOC for component performance monitoring
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const PerformanceMonitoredComponent = (props: P) => {
    const name = componentName || Component.displayName || Component.name || 'Unknown';
    useRenderTracking(name, props as Record<string, any>);
    return <Component {...props} />;
  };

  PerformanceMonitoredComponent.displayName = `PerformanceMonitored(${
    Component.displayName || Component.name
  })`;

  return PerformanceMonitoredComponent;
}

// Optimized context provider
export function createOptimizedProvider<T>(
  Context: React.Context<T | undefined>,
  useValue: () => T
): React.ComponentType<{ children: React.ReactNode }> {
  return memo(function OptimizedProvider({ children }) {
    const value = useValue();
    const memoizedValue = useMemo(() => value, [value]);

    return (
      <Context.Provider value={memoizedValue}>
        {children}
      </Context.Provider>
    );
  });
}

// Render batching utility
export function useBatchedRender(): {
  batchRender: (callback: () => void) => void;
  flushBatch: () => void;
} {
  const batchRef = useRef<(() => void)[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flushBatch = useCallback(() => {
    React.unstable_batchedUpdates(() => {
      batchRef.current.forEach(callback => callback());
      batchRef.current = [];
    });

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const batchRender = useCallback((callback: () => void) => {
    batchRef.current.push(callback);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(flushBatch, 0);
  }, [flushBatch]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { batchRender, flushBatch };
}

// Development only: Render tracking
export function RenderTracker({ 
  name, 
  props, 
  children 
}: { 
  name: string; 
  props?: Record<string, any>; 
  children: React.ReactNode;
}): JSX.Element {
  if (process.env.NODE_ENV === 'development') {
    useRenderTracking(name, props);
  }
  return <>{children}</>;
}

// Export all optimizations
export const ReactOptimizations = {
  createOptimizedMemo,
  createDeepMemo,
  createShallowMemo,
  useOptimizedCallback,
  useOptimizedMemo,
  withRenderOptimization,
  withPerformanceMonitoring,
  useConditionalRender,
  useLazyComponent,
  OptimizedList,
  createOptimizedProvider,
  useBatchedRender,
  RenderTracker,
};