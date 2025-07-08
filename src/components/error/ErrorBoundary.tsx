'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { captureServerError } from '../../../sentry.server.config';

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
  learningSessionId?: string;
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
  level?: 'application' | 'feature' | 'component' | 'learning';
  name?: string;
  showDetails?: boolean;
  userId?: string;
  sessionId?: string;
  learningSessionId?: string;
}

// Enhanced Error Boundary Component
export class EnhancedErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
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
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.reportError(error, errorInfo);

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
        level: this.props.level || 'component',
        learning_session_id: this.props.learningSessionId,
      });
    }
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
  }

  private reportError(error: Error, errorInfo: ErrorInfo): string {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Report to Sentry with enhanced context
    Sentry.withScope((scope) => {
      scope.setTag('error_boundary', this.props.name || 'unknown');
      scope.setTag('error_level', this.props.level || 'component');
      scope.setTag('retry_count', this.state.retryCount);
      scope.setTag('error_id', errorId);
      
      if (this.props.userId) {
        scope.setUser({ id: this.props.userId });
      }
      
      if (this.props.sessionId) {
        scope.setContext('session', { id: this.props.sessionId });
      }
      
      if (this.props.learningSessionId) {
        scope.setContext('learning_session', { id: this.props.learningSessionId });
      }
      
      scope.setContext('error_boundary', {
        name: this.props.name,
        level: this.props.level,
        retryCount: this.state.retryCount,
        componentStack: errorInfo.componentStack,
      });
      
      scope.setContext('browser', {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });
      
      Sentry.captureException(error);
    });

    return errorId;
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
      
      // Track retry attempt
      if (typeof window !== 'undefined' && 'gtag' in window) {
        (window as any).gtag('event', 'error_boundary_retry', {
          error_boundary: this.props.name || 'unknown',
          retry_count: this.state.retryCount + 1,
          level: this.props.level || 'component',
        });
      }
    }
  };

  private handleReload = () => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'error_boundary_reload', {
        error_boundary: this.props.name || 'unknown',
        level: this.props.level || 'component',
      });
    }
    window.location.reload();
  };

  private handleReportError = () => {
    if (this.state.error && this.state.errorInfo) {
      const errorDetails: ErrorDetails = {
        message: this.state.error.message,
        stack: this.state.error.stack,
        componentStack: this.state.errorInfo.componentStack,
        errorBoundary: this.props.name || 'unknown',
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: this.props.userId,
        sessionId: this.props.sessionId,
        learningSessionId: this.props.learningSessionId,
      };

      // Create downloadable error report
      const blob = new Blob([JSON.stringify(errorDetails, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-report-${this.state.errorId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
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
      const isLearningLevel = level === 'learning';
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
                  {isApplicationLevel 
                    ? 'Application Error' 
                    : isLearningLevel 
                      ? 'Learning Session Error' 
                      : 'Something went wrong'}
                </h3>
                <p className="text-sm text-red-600">
                  {isApplicationLevel 
                    ? 'The application encountered an unexpected error.' 
                    : isLearningLevel
                      ? 'Your learning session encountered an error. Your progress has been saved.'
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
              {isLearningLevel && this.props.learningSessionId && (
                <div>Learning Session: <span className="font-mono text-xs">{this.props.learningSessionId}</span></div>
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

              {isLearningLevel && (
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Return to Dashboard
                </button>
              )}

              <button
                onClick={this.handleReportError}
                className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Download Error Report
              </button>
            </div>

            {!canRetry && (
              <div className="mt-4 p-3 bg-yellow-100 rounded">
                <p className="text-sm text-yellow-800">
                  Maximum retry attempts reached. Please refresh the page or contact support if the issue persists.
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

// Specialized error boundary for learning sessions
export class LearningSessionErrorBoundary extends Component<
  { children: ReactNode; sessionId: string; userId?: string },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; sessionId: string; userId?: string }) {
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
    const errorId = `learning-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Report to Sentry with learning session context
    Sentry.withScope((scope) => {
      scope.setTag('error_boundary', 'learning_session');
      scope.setTag('error_type', 'learning_session_error');
      scope.setTag('session_id', this.props.sessionId);
      
      if (this.props.userId) {
        scope.setUser({ id: this.props.userId });
      }
      
      scope.setContext('learning_session', {
        id: this.props.sessionId,
        error_id: errorId,
        timestamp: new Date().toISOString(),
      });
      
      scope.setContext('error_info', {
        componentStack: errorInfo.componentStack,
        stack: error.stack,
      });
      
      Sentry.captureException(error);
    });

    this.setState({
      errorInfo,
      errorId,
    });

    // Save learning session state on error
    this.saveLearningSessionState();
  }

  private async saveLearningSessionState() {
    try {
      await fetch('/api/learning/session/save-error-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.props.sessionId,
          errorId: this.state.errorId,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to save learning session state:', error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-blue-800">Learning Session Interrupted</h3>
                <p className="text-sm text-blue-600">
                  Don't worry! Your progress has been automatically saved.
                </p>
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-4">
              <div>Session ID: <span className="font-mono text-xs">{this.props.sessionId}</span></div>
              <div>Error ID: <span className="font-mono text-xs">{this.state.errorId}</span></div>
            </div>

            <div className="flex flex-col space-y-2">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Return to Dashboard
              </button>
              
              <button
                onClick={() => window.location.href = `/learning/session/${this.props.sessionId}`}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Resume Learning Session
              </button>
            </div>

            <div className="mt-4 p-3 bg-blue-100 rounded">
              <p className="text-sm text-blue-800">
                Your learning progress is safe and has been automatically saved. 
                You can resume from where you left off at any time.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
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

// Hook for manual error reporting
export function useErrorReporting() {
  const reportError = (error: Error, context?: Record<string, any>) => {
    const errorId = `manual-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    Sentry.withScope((scope) => {
      scope.setTag('error_type', 'manual_report');
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
      
      Sentry.captureException(error);
    });
    
    return errorId;
  };

  return { reportError };
}

export default EnhancedErrorBoundary;