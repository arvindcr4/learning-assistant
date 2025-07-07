import React, { memo, useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * Performance optimization utilities for React components
 */

// Memoized wrapper for stable callback functions
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback((...args: any[]) => {
    return callbackRef.current(...args);
  }, []) as T;
}

// Hook for memoizing expensive calculations
export function useDeepMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const depsRef = useRef<React.DependencyList>();
  const resultRef = useRef<T>();

  const hasChanged = !depsRef.current || 
    depsRef.current.length !== deps.length ||
    depsRef.current.some((dep, index) => dep !== deps[index]);

  if (hasChanged) {
    depsRef.current = deps;
    resultRef.current = factory();
  }

  return resultRef.current!;
}

// Optimized callback hook
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
}

// Optimized memo hook (alias for useMemo)
export function useOptimizedMemo<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(factory, deps);
}

// Conditional render hook
export function useConditionalRender<T>(
  condition: boolean,
  component: () => T
): T | null {
  return useMemo(() => {
    return condition ? component() : null;
  }, [condition, component]);
}

// Deferred value hook (for React 18 compatibility)
export function useDeferredValue<T>(value: T): T {
  // For backward compatibility, just return the value
  // In React 18+, this would use React.useDeferredValue
  return value;
}

// Memory leak prevention hook
export function useMemoryLeakPrevention() {
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isMounted = useCallback(() => mountedRef.current, []);

  return { isMounted };
}

// Deep equality comparison function
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

// Shallow equality comparison function
export function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  
  return true;
}

// Optimized memo wrapper with custom comparison
export function createMemoComponent<T extends React.ComponentType<any>>(
  Component: T,
  areEqual?: (prevProps: Readonly<React.ComponentProps<T>>, nextProps: Readonly<React.ComponentProps<T>>) => boolean
) {
  return memo(Component, areEqual);
}

// Create optimized memo component
export function createOptimizedMemo<T extends React.ComponentType<any>>(
  Component: T
) {
  const MemoizedComponent = memo(Component);
  MemoizedComponent.displayName = `Memo(${Component.displayName || Component.name || 'Component'})`;
  return MemoizedComponent;
}

// Create deep memo component
export function createDeepMemo<T extends React.ComponentType<any>>(
  Component: T
) {
  const MemoizedComponent = memo(Component, (prevProps: Readonly<React.ComponentProps<T>>, nextProps: Readonly<React.ComponentProps<T>>) => {
    return deepEqual(prevProps, nextProps);
  });
  MemoizedComponent.displayName = `Memo(${Component.displayName || Component.name || 'Component'})`;
  return MemoizedComponent;
}

// Create shallow memo component
export function createShallowMemo<T extends React.ComponentType<any>>(
  Component: T
) {
  const MemoizedComponent = memo(Component, (prevProps: Readonly<React.ComponentProps<T>>, nextProps: Readonly<React.ComponentProps<T>>) => {
    return shallowEqual(prevProps, nextProps);
  });
  MemoizedComponent.displayName = `Tracked(${Component.displayName || Component.name || 'Component'})`;
  return MemoizedComponent;
}

// Debounced state hook
export function useDebouncedState<T>(initialValue: T, delay: number): [T, React.Dispatch<React.SetStateAction<T>>, T] {
  const [value, setValue] = React.useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = React.useState<T>(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return [value, setValue, debouncedValue];
}

// Throttled callback hook
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const throttledRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: any[]) => {
    if (!throttledRef.current) {
      callback(...args);
      throttledRef.current = true;

      timeoutRef.current = setTimeout(() => {
        throttledRef.current = false;
      }, delay);
    }
  }, [callback, delay]) as T;
}

// Component state optimization hook
export function useOptimizedState<T>(
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = React.useState<T>(initialValue);

  const optimizedSetState = useCallback((value: T | ((prev: T) => T)) => {
    setState(prevState => {
      const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prevState) : value;
      
      // Only update if value actually changed
      if (Object.is(newValue, prevState)) {
        return prevState;
      }
      
      return newValue;
    });
  }, []);

  return [state, optimizedSetState];
}

// Error boundary HOC
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>
) {
  return class ErrorBoundaryWrapper extends React.Component<
    P,
    { hasError: boolean; error: Error | null }
  > {
    constructor(props: P) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      console.error('Component error:', error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        const FallbackComponent = fallback || DefaultErrorFallback;
        return (
          <FallbackComponent
            error={this.state.error!}
            reset={() => this.setState({ hasError: false, error: null })}
          />
        );
      }

      return <Component {...this.props} />;
    }
  };
}

// Default error fallback component
const DefaultErrorFallback: React.FC<{ error: Error; reset: () => void }> = ({ error, reset }) => (
  <div className="error-boundary p-4 border border-red-300 bg-red-50 rounded">
    <h2 className="text-red-700 font-semibold mb-2">Something went wrong</h2>
    <details className="mb-4">
      <summary className="cursor-pointer text-red-600">Error details</summary>
      <pre className="text-sm mt-2 text-red-600">{error.message}</pre>
    </details>
    <button
      onClick={reset}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
    >
      Try again
    </button>
  </div>
);

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const renderCountRef = useRef(0);
  const startTimeRef = useRef<number>();

  useEffect(() => {
    renderCountRef.current += 1;
    startTimeRef.current = performance.now();

    return () => {
      if (startTimeRef.current) {
        const renderTime = performance.now() - startTimeRef.current;
        
        if (renderTime > 16) { // More than one frame (16ms)
          console.warn(
            `${componentName} slow render: ${renderTime.toFixed(2)}ms (render #${renderCountRef.current})`
          );
        }
      }
    };
  });

  return {
    renderCount: renderCountRef.current,
  };
}

// Optimized context provider
export function createOptimizedProvider<T>(
  defaultValue: T,
  contextName: string
) {
  const Context = React.createContext<T>(defaultValue);
  Context.displayName = contextName;

  const Provider: React.FC<{ value: T; children: React.ReactNode }> = ({ value, children }) => {
    const memoizedValue = useMemo(() => value, [value]);

    return (
      <Context.Provider value={memoizedValue}>
        {children}
      </Context.Provider>
    );
  };

  const useContext = () => {
    const context = React.useContext(Context);
    if (context === undefined) {
      throw new Error(`use${contextName} must be used within a ${contextName}Provider`);
    }
    return context;
  };

  return {
    Context,
    Provider,
    useContext,
  };
}

// Form field optimization hook
export function useOptimizedFormField<T>(
  name: string,
  value: T,
  onChange: (value: T) => void,
  validation?: (value: T) => string | undefined
) {
  const [error, setError] = React.useState<string>();
  const [touched, setTouched] = React.useState(false);

  const handleChange = useCallback((newValue: T) => {
    onChange(newValue);
    if (touched && validation) {
      setError(validation(newValue));
    }
  }, [onChange, touched, validation]);

  const handleBlur = useCallback(() => {
    setTouched(true);
    if (validation) {
      setError(validation(value));
    }
  }, [validation, value]);

  const isValid = !error && touched;
  const showError = error && touched;

  return {
    value,
    onChange: handleChange,
    onBlur: handleBlur,
    error,
    isValid,
    showError,
    touched,
  };
}

// React optimizations export object for compatibility
export const ReactOptimizations = {
  createOptimizedMemo,
  createDeepMemo,
  createShallowMemo,
  deepEqual,
  shallowEqual,
  useStableCallback,
  useDeepMemo,
  useOptimizedCallback,
  useOptimizedMemo,
  useConditionalRender,
  useDeferredValue,
  useMemoryLeakPrevention,
  createMemoComponent,
  useDebouncedState,
  useThrottledCallback,
  useOptimizedState,
  withErrorBoundary,
  usePerformanceMonitor,
  createOptimizedProvider,
  useOptimizedFormField,
};

export default {
  ...ReactOptimizations,
};