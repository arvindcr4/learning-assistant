'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { captureErrorBoundary } from '@/lib/sentry';

// Error types
interface ErrorDetails {
  message: string;
  stack?: string;
  componentStack?: string;
  errorBoundary?: string;
  timestamp: number;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean;
  maxRetries?: number;
  level?: 'application' | 'feature' | 'component';
  name?: string;
  showDetails?: boolean;
}

// Error reporting service
class ErrorReporter {
  private static instance: ErrorReporter;
  private errors: ErrorDetails[] = [];
  private maxErrors = 100;

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }

  reportError(error: Error, errorInfo: ErrorInfo, context?: any): string {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const errorDetails: ErrorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: context?.errorBoundary,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: context?.userId,
      sessionId: context?.sessionId,
    };

    this.errors.push(errorDetails);
    
    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Report to Sentry
    captureErrorBoundary(error, errorInfo);
    
    // Report to external service (implement your own)
    this.sendToExternalService(errorDetails, errorId);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error reported:', { errorId, errorDetails });
    }

    return errorId;
  }

  private async sendToExternalService(errorDetails: ErrorDetails, errorId: string): Promise<void> {
    try {
      // Replace with your actual error reporting service
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ errorId, ...errorDetails }),
      // });
      
      console.log('Error would be sent to external service:', { errorId, errorDetails });
    } catch (error) {
      console.error('Failed to report error to external service:', error);
    }
  }

  getErrors(): ErrorDetails[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
  }

  exportErrors(): void {
    const data = {
      errors: this.errors,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Enhanced Error Boundary Component
export class EnhancedErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorReporter: ErrorReporter;
  private retryTimeouts: NodeJS.Timeout[] = [];

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: '',
    };
    this.errorReporter = ErrorReporter.getInstance();
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.errorReporter.reportError(error, errorInfo, {
      errorBoundary: this.props.name || 'UnknownErrorBoundary',
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
    });

    this.setState({
      errorInfo,
      errorId,
    });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Send to analytics
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: false,
        error_boundary: this.props.name || 'unknown',
        retry_count: this.state.retryCount,
      });
    }
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
  }

  private getUserId(): string | undefined {
    // Implement your user ID logic
    return undefined;
  }

  private getSessionId(): string | undefined {
    // Implement your session ID logic
    return undefined;
  }

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount < maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1,
      });
    }
  };

  private handleAutoRetry = () => {
    // Auto-retry after 3 seconds for non-critical errors
    const timeout = setTimeout(() => {
      this.handleRetry();
    }, 3000);
    
    this.retryTimeouts.push(timeout);
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleReportError = () => {
    this.errorReporter.exportErrors();
  };

  render() {
    if (this.state.hasError) {
      const { fallback, level = 'component', showDetails = false, maxRetries = 3 } = this.props;
      const { error, errorInfo, retryCount, errorId } = this.state;

      // Custom fallback UI
      if (fallback) {
        return fallback;
      }

      // Different UI based on error level
      const isApplicationLevel = level === 'application';
      const canRetry = retryCount < maxRetries;

      return (
        <div className={`error-boundary ${isApplicationLevel ? 'min-h-screen' : ''} flex items-center justify-center bg-red-50 p-4`}>
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-red-800">
                  {isApplicationLevel ? 'Application Error' : 'Something went wrong'}
                </h3>
                <p className="text-sm text-red-600">
                  {isApplicationLevel 
                    ? 'The application encountered an unexpected error.' 
                    : 'This component failed to render properly.'}
                </p>
              </div>
            </div>

            {showDetails && error && (
              <div className="mb-4 p-3 bg-red-100 rounded text-xs font-mono text-red-800 overflow-auto max-h-32">
                <div className="font-bold mb-1">Error: {error.message}</div>
                {error.stack && (
                  <div className="opacity-75">
                    Stack: {error.stack.split('\n').slice(0, 3).join('\n')}
                  </div>
                )}
              </div>
            )}

            <div className="text-sm text-gray-600 mb-4">
              <div>Error ID: <span className="font-mono text-xs">{errorId}</span></div>
              {retryCount > 0 && (
                <div>Retry attempts: {retryCount}/{maxRetries}</div>
              )}
            </div>

            <div className="flex flex-col space-y-2">
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              )}
              
              {isApplicationLevel && (
                <button
                  onClick={this.handleReload}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  Reload Page
                </button>
              )}

              <button
                onClick={this.handleReportError}
                className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Report Error
              </button>
            </div>

            {!canRetry && (
              <div className="mt-4 p-3 bg-yellow-100 rounded">
                <p className="text-sm text-yellow-800">
                  Maximum retry attempts reached. Please refresh the page or contact support.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Specialized error boundaries for different contexts
export class ContextErrorBoundary extends Component<
  { children: ReactNode; contextName: string },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; contextName: string }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorReporter = ErrorReporter.getInstance();
    const errorId = errorReporter.reportError(error, errorInfo, {
      errorBoundary: `${this.props.contextName}Context`,
      contextName: this.props.contextName,
    });

    this.setState({
      errorInfo,
      errorId,
    });

    console.error(`${this.props.contextName} Context Error:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="text-red-800 font-semibold">
            {this.props.contextName} Context Error
          </h3>
          <p className="text-red-600 text-sm mt-1">
            {this.state.error?.message || 'An error occurred in the context provider'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for error reporting
export function useErrorReporting(): {
  reportError: (error: Error, context?: any) => string;
  getErrors: () => ErrorDetails[];
  clearErrors: () => void;
  exportErrors: () => void;
} {
  const errorReporter = ErrorReporter.getInstance();
  
  const reportError = (error: Error, context?: any) => {
    return errorReporter.reportError(error, { componentStack: '' }, context);
  };

  return {
    reportError,
    getErrors: () => errorReporter.getErrors(),
    clearErrors: () => errorReporter.clearErrors(),
    exportErrors: () => errorReporter.exportErrors(),
  };
}

// Error boundary HOC
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Error boundary for async operations
export function AsyncErrorBoundary({ children, onError }: { children: ReactNode; onError?: (error: Error) => void }) {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = new Error(event.reason?.message || 'Unhandled promise rejection');
      setError(error);
      onError?.(error);
      
      // Report to Sentry
      Sentry.captureException(error, {
        tags: {
          error_boundary: 'async',
          error_type: 'unhandled_promise_rejection',
        },
        extra: {
          reason: event.reason,
        },
      });
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, [onError]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <h3 className="text-red-800 font-semibold">Async Operation Error</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
        <button 
          onClick={() => setError(null)}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

// Error dashboard component
export function ErrorDashboard() {
  const { getErrors, clearErrors, exportErrors } = useErrorReporting();
  const [errors, setErrors] = React.useState<ErrorDetails[]>([]);

  React.useEffect(() => {
    const updateErrors = () => setErrors(getErrors());
    updateErrors();
    
    const interval = setInterval(updateErrors, 5000);
    return () => clearInterval(interval);
  }, [getErrors]);

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Error Dashboard</h3>
      
      <div className="flex gap-2 mb-4">
        <div className="bg-white p-3 rounded">
          <div className="text-sm text-gray-600">Total Errors</div>
          <div className="text-2xl font-bold text-red-600">{errors.length}</div>
        </div>
        <div className="bg-white p-3 rounded">
          <div className="text-sm text-gray-600">Recent Errors</div>
          <div className="text-2xl font-bold text-orange-600">
            {errors.filter(e => Date.now() - e.timestamp < 5 * 60 * 1000).length}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={exportErrors}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Export Errors
        </button>
        <button
          onClick={clearErrors}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Clear Errors
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {errors.slice(-10).reverse().map((error, index) => (
          <div key={index} className="bg-white p-3 rounded border-l-4 border-red-500">
            <div className="text-sm font-medium text-red-800">{error.message}</div>
            <div className="text-xs text-gray-600 mt-1">
              {new Date(error.timestamp).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Default export
export default EnhancedErrorBoundary;