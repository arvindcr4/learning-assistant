'use client';

import React, { ReactNode, useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error) => void;
  fallback?: ReactNode;
  isolate?: boolean;
}

// Error boundary for async operations and promise rejections
export function AsyncErrorBoundary({ 
  children, 
  onError, 
  fallback,
  isolate = false 
}: AsyncErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = new Error(
        event.reason?.message || 
        (typeof event.reason === 'string' ? event.reason : 'Unhandled promise rejection')
      );
      
      const errorId = `async-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      setError(error);
      setErrorId(errorId);
      onError?.(error);
      
      // Report to Sentry
      Sentry.withScope((scope) => {
        scope.setTag('error_boundary', 'async');
        scope.setTag('error_type', 'unhandled_promise_rejection');
        scope.setTag('error_id', errorId);
        scope.setTag('isolated', isolate);
        
        scope.setContext('promise_rejection', {
          reason: event.reason,
          promise: event.promise.toString(),
          url: window.location.href,
          timestamp: new Date().toISOString(),
        });
        
        Sentry.captureException(error);
      });

      // Prevent default behavior if we're isolating the error
      if (isolate) {
        event.preventDefault();
      }
    };

    const handleError = (event: ErrorEvent) => {
      const error = new Error(event.message || 'Script error');
      const errorId = `script-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      setError(error);
      setErrorId(errorId);
      onError?.(error);
      
      // Report to Sentry
      Sentry.withScope((scope) => {
        scope.setTag('error_boundary', 'async');
        scope.setTag('error_type', 'script_error');
        scope.setTag('error_id', errorId);
        scope.setTag('isolated', isolate);
        
        scope.setContext('script_error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        });
        
        Sentry.captureException(error);
      });

      // Prevent default behavior if we're isolating the error
      if (isolate) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, [onError, isolate]);

  if (error) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center mb-2">
          <svg className="h-5 w-5 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-red-800 font-semibold">Async Operation Error</h3>
        </div>
        
        <p className="text-red-600 text-sm mb-3">{error.message}</p>
        
        {errorId && (
          <div className="text-xs text-gray-600 mb-3">
            Error ID: <span className="font-mono">{errorId}</span>
          </div>
        )}
        
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setError(null);
              setErrorId(null);
            }}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
          >
            Dismiss
          </button>
          
          <button 
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Hook for handling async errors within components
export function useAsyncErrorHandler() {
  const handleAsyncError = (error: Error, context?: Record<string, any>) => {
    const errorId = `async-handler-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    Sentry.withScope((scope) => {
      scope.setTag('error_type', 'async_handler');
      scope.setTag('error_id', errorId);
      
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          if (typeof value === 'string') {
            scope.setTag(key, value);
          } else {
            scope.setContext(key, value);
          }
        });
      }
      
      scope.setContext('async_error', {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
      
      Sentry.captureException(error);
    });
    
    return errorId;
  };

  const wrapAsyncFunction = <T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: Record<string, any>
  ) => {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        const errorId = handleAsyncError(error as Error, context);
        throw Object.assign(error as Error, { errorId });
      }
    };
  };

  return { handleAsyncError, wrapAsyncFunction };
}

export default AsyncErrorBoundary;