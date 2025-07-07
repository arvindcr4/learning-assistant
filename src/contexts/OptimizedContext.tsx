'use client';

import React, { createContext, useContext, useCallback, useMemo, useRef, ReactNode } from 'react';

// Context selector types
export type ContextSelector<T, R> = (state: T) => R;

// Optimized context with selectors
export interface OptimizedContextValue<T> {
  state: T;
  dispatch: React.Dispatch<any>;
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => T;
}

// Create optimized context with selectors
export function createOptimizedContext<T>() {
  const Context = createContext<OptimizedContextValue<T> | null>(null);
  
  // Hook to use context with selector
  function useContextSelector<R>(
    selector: ContextSelector<T, R>,
    equalityFn?: (a: R, b: R) => boolean
  ): R {
    const context = useContext(Context);
    if (!context) {
      throw new Error('useContextSelector must be used within a Provider');
    }

    const { getSnapshot, subscribe } = context;
    const selectorRef = useRef(selector);
    const equalityRef = useRef(equalityFn);
    
    // Update refs
    selectorRef.current = selector;
    equalityRef.current = equalityFn;

    // Use useSyncExternalStore for optimal performance
    const selectedValue = React.useSyncExternalStore(
      subscribe,
      () => selectorRef.current(getSnapshot()),
      () => selectorRef.current(getSnapshot())
    );

    return selectedValue;
  }

  // Hook to use full context (for dispatch)
  function useContextDispatch() {
    const context = useContext(Context);
    if (!context) {
      throw new Error('useContextDispatch must be used within a Provider');
    }
    return context.dispatch;
  }

  return {
    Context,
    useContextSelector,
    useContextDispatch,
  };
}

// Optimized provider wrapper
export function createOptimizedProvider<T, A>(
  initialState: T,
  reducer: (state: T, action: A) => T,
  Context: React.Context<OptimizedContextValue<T> | null>
) {
  return function Provider({ children }: { children: ReactNode }) {
    const [state, dispatch] = React.useReducer(reducer, initialState);
    const listenersRef = useRef<Set<() => void>>(new Set());

    // Notify listeners on state change
    const prevStateRef = useRef(state);
    React.useEffect(() => {
      if (prevStateRef.current !== state) {
        prevStateRef.current = state;
        listenersRef.current.forEach(listener => listener());
      }
    }, [state]);

    const subscribe = useCallback((callback: () => void) => {
      listenersRef.current.add(callback);
      return () => {
        listenersRef.current.delete(callback);
      };
    }, []);

    const getSnapshot = useCallback(() => state, [state]);

    const value = useMemo(() => ({
      state,
      dispatch,
      subscribe,
      getSnapshot,
    }), [state, dispatch, subscribe, getSnapshot]);

    return (
      <Context.Provider value={value}>
        {children}
      </Context.Provider>
    );
  };
}

// Utility hooks for common selector patterns
export function useDeepCompareMemo<T>(value: T): T {
  const ref = useRef<T>();
  
  if (!ref.current || JSON.stringify(ref.current) !== JSON.stringify(value)) {
    ref.current = value;
  }
  
  return ref.current;
}

export function useShallowCompareMemo<T extends Record<string, any>>(value: T): T {
  const ref = useRef<T>();
  
  if (!ref.current || !shallowEqual(ref.current, value)) {
    ref.current = value;
  }
  
  return ref.current;
}

function shallowEqual(obj1: any, obj2: any): boolean {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) {
    return false;
  }
  
  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) {
      return false;
    }
  }
  
  return true;
}

// Memoized context value creator
export function useMemoizedContextValue<T>(
  value: T,
  dependencies: React.DependencyList
): T {
  return useMemo(() => value, dependencies);
}

// Context composition helper
export function composeProviders(
  ...providers: Array<React.ComponentType<{ children: ReactNode }>>
): React.ComponentType<{ children: ReactNode }> {
  return providers.reduce(
    (AccumulatedProviders, CurrentProvider) => 
      ({ children }: { children: ReactNode }) => (
        <AccumulatedProviders>
          <CurrentProvider>{children}</CurrentProvider>
        </AccumulatedProviders>
      ),
    ({ children }: { children: ReactNode }) => <>{children}</>
  );
}

// Performance monitoring for context
export function useContextPerformance(contextName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());
  
  renderCount.current++;
  
  React.useEffect(() => {
    const currentTime = performance.now();
    const timeDiff = currentTime - lastRenderTime.current;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`${contextName} render #${renderCount.current} - ${timeDiff.toFixed(2)}ms since last render`);
    }
    
    lastRenderTime.current = currentTime;
  });
  
  return renderCount.current;
}

// Batch updates helper
export function useBatchedDispatch<A>(
  dispatch: React.Dispatch<A>,
  delay: number = 16
): (action: A) => void {
  const actionsRef = useRef<A[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const batchedDispatch = useCallback((action: A) => {
    actionsRef.current.push(action);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      const actions = actionsRef.current;
      actionsRef.current = [];
      
      // Dispatch all actions in a single batch
      React.unstable_batchedUpdates(() => {
        actions.forEach(dispatch);
      });
    }, delay);
  }, [dispatch, delay]);

  return batchedDispatch;
}

// Error boundary for contexts
export class ContextErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode; onError?: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Context Error:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="text-red-800 font-semibold">Context Error</h3>
          <p className="text-red-600">{this.state.error?.message}</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}