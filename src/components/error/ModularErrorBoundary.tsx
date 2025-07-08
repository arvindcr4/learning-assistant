/**
 * Modular Error Boundary Component
 * A more maintainable and modular version of the error boundary
 */

import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react';

import { ErrorReporter } from './ErrorReporter';
import { ErrorFallback } from './ErrorFallbackUI';

/**
 * Error boundary state interface
 */
interface ErrorBoundaryState {
  /** Whether an error has occurred */
  hasError: boolean;
  /** The error object */
  error: Error | null;
  /** React error info */
  errorInfo: ErrorInfo | null;
  /** Number of retry attempts */
  retryCount: number;
  /** Unique error ID for tracking */
  errorId: string;
}

/**
 * Error boundary props interface
 */
export interface ErrorBoundaryProps {
  /** Child components */
  children: ReactNode;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Error callback handler */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to isolate errors to this boundary */
  isolate?: boolean;
  /** Maximum number of retries */
  maxRetries?: number;
  /** Error boundary level */
  level?: 'application' | 'feature' | 'component';
  /** Error boundary name for identification */
  name?: string;
  /** Whether to show error details */
  showDetails?: boolean;
}

/**
 * Modular Error Boundary Component
 * Provides comprehensive error handling with retry logic and reporting
 */
export class ModularErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private readonly errorReporter: ErrorReporter;
  private readonly maxRetries: number;

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
    this.maxRetries = props.maxRetries ?? 3;
  }

  /**
   * Static method to derive state from error
   * @param error - The error that occurred
   * @returns Partial state update
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  /**
   * Called when an error is caught by the boundary
   * @param error - The error that occurred
   * @param errorInfo - React error info
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Report error with context
    this.errorReporter.reportError(error, errorInfo, {
      errorBoundary: this.props.name || 'ErrorBoundary',
      level: this.props.level || 'component',
      retryCount: this.state.retryCount,
      isolate: this.props.isolate,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  /**
   * Resets the error boundary state for retry
   */
  private resetError = (): void => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
        errorId: '',
      }));
    }
  };

  /**
   * Checks if retry is possible
   * @returns Whether retry is allowed
   */
  private canRetry(): boolean {
    return this.state.retryCount < this.maxRetries;
  }

  /**
   * Renders the component
   * @returns JSX element
   */
  render(): ReactNode {
    if (this.state.hasError) {
      // Return custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Return level-appropriate error fallback
      return (
        <ErrorFallback
          error={this.state.error || undefined}
          resetError={this.canRetry() ? this.resetError : undefined}
          level={this.props.level}
          showDetails={this.props.showDetails}
          title={this.getErrorTitle()}
          description={this.getErrorDescription()}
        />
      );
    }

    return this.props.children;
  }

  /**
   * Gets appropriate error title based on level
   * @returns Error title
   */
  private getErrorTitle(): string {
    const { level, name } = this.props;
    
    if (name) {
      return `${name} Error`;
    }
    
    switch (level) {
      case 'application':
        return 'Application Error';
      case 'feature':
        return 'Feature Error';
      case 'component':
      default:
        return 'Component Error';
    }
  }

  /**
   * Gets appropriate error description based on level and retry count
   * @returns Error description
   */
  private getErrorDescription(): string {
    const { level } = this.props;
    const { retryCount } = this.state;
    
    let baseDescription = '';
    
    switch (level) {
      case 'application':
        baseDescription = 'The application encountered an unexpected error.';
        break;
      case 'feature':
        baseDescription = 'This feature is temporarily unavailable.';
        break;
      case 'component':
      default:
        baseDescription = 'This component could not be displayed.';
        break;
    }
    
    if (retryCount > 0) {
      baseDescription += ` (Attempt ${retryCount + 1}/${this.maxRetries + 1})`;
    }
    
    if (!this.canRetry() && retryCount >= this.maxRetries) {
      baseDescription += ' Maximum retry attempts reached.';
    }
    
    return baseDescription;
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 * @param WrappedComponent - Component to wrap
 * @param errorBoundaryProps - Error boundary props
 * @returns Wrapped component
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ModularErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ModularErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = 
    `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}

/**
 * Hook for error boundary context (for functional components)
 * This would be used in a future refactor to React 18+ with error boundary hooks
 */
export function useErrorHandler() {
  const errorReporter = ErrorReporter.getInstance();
  
  return {
    reportError: (error: Error, context?: Record<string, unknown>) => {
      errorReporter.reportError(error, undefined, context);
    },
    getErrorHistory: () => errorReporter.getErrorHistory(),
    clearErrorHistory: () => errorReporter.clearErrorHistory(),
  };
}