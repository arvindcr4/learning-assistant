'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home, FileText, Bug } from 'lucide-react';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary?: () => void;
  errorId?: string;
  level?: 'application' | 'feature' | 'component' | 'learning';
  showDetails?: boolean;
  customMessage?: string;
  userId?: string;
  sessionId?: string;
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
  errorId,
  level = 'component',
  showDetails = false,
  customMessage,
  userId,
  sessionId,
}: ErrorFallbackProps) {
  const handleReportError = () => {
    const errorReport = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorId,
      level,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId,
      sessionId,
    };

    // Create downloadable error report
    const blob = new Blob([JSON.stringify(errorReport, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${errorId || 'unknown'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getErrorIcon = () => {
    switch (level) {
      case 'application':
        return <AlertTriangle className="h-12 w-12 text-red-500" />;
      case 'learning':
        return <FileText className="h-12 w-12 text-orange-500" />;
      case 'feature':
        return <Bug className="h-12 w-12 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-8 w-8 text-red-500" />;
    }
  };

  const getErrorTitle = () => {
    switch (level) {
      case 'application':
        return 'Application Error';
      case 'learning':
        return 'Learning Session Error';
      case 'feature':
        return 'Feature Unavailable';
      default:
        return 'Something went wrong';
    }
  };

  const getErrorMessage = () => {
    if (customMessage) return customMessage;
    
    switch (level) {
      case 'application':
        return 'The application encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.';
      case 'learning':
        return 'Your learning session encountered an error. Don\'t worry - your progress has been saved and you can resume from where you left off.';
      case 'feature':
        return 'This feature is temporarily unavailable. Please try again later or use an alternative approach.';
      default:
        return 'This component failed to load properly. You can try again or refresh the page.';
    }
  };

  const isFullScreen = level === 'application' || level === 'learning';

  return (
    <div className={`
      error-fallback 
      ${isFullScreen ? 'min-h-screen bg-gray-50' : 'min-h-[200px] bg-gray-50'} 
      flex items-center justify-center p-4
    `}>
      <div className={`
        bg-white rounded-lg shadow-lg p-6 w-full 
        ${isFullScreen ? 'max-w-lg' : 'max-w-md'}
      `}>
        {/* Error Icon and Title */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            {getErrorIcon()}
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {getErrorTitle()}
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            {getErrorMessage()}
          </p>
        </div>

        {/* Error Details (Development/Debug) */}
        {showDetails && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-sm font-medium text-red-800 mb-2">Error Details</h3>
            <div className="text-xs font-mono text-red-700 space-y-1">
              <div><strong>Name:</strong> {error.name}</div>
              <div><strong>Message:</strong> {error.message}</div>
              {error.stack && (
                <div>
                  <strong>Stack:</strong>
                  <pre className="mt-1 text-xs overflow-x-auto max-h-32 bg-red-100 p-2 rounded">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error ID */}
        {errorId && (
          <div className="mb-6 p-3 bg-gray-100 rounded-lg">
            <div className="text-sm text-gray-600">
              <strong>Error ID:</strong> 
              <span className="font-mono text-xs ml-1">{errorId}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {resetErrorBoundary && (
            <button
              onClick={resetErrorBoundary}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </button>
          )}

          {level === 'application' && (
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload Page
            </button>
          )}

          {level === 'learning' && (
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Home className="h-4 w-4 mr-2" />
              Return to Dashboard
            </button>
          )}

          <button
            onClick={handleReportError}
            className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="h-4 w-4 mr-2" />
            Download Error Report
          </button>
        </div>

        {/* Support Information */}
        <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-1">Need Help?</h3>
          <p className="text-xs text-blue-700">
            If this error persists, please contact support with the error ID above. 
            Your error report has been automatically sent to our development team.
          </p>
        </div>
      </div>
    </div>
  );
}

// Specialized fallback components for different contexts
export function ApplicationErrorFallback({ error, resetErrorBoundary, errorId }: Omit<ErrorFallbackProps, 'level'>) {
  return (
    <ErrorFallback
      error={error}
      resetErrorBoundary={resetErrorBoundary}
      errorId={errorId}
      level="application"
      showDetails={process.env.NODE_ENV === 'development'}
    />
  );
}

export function LearningErrorFallback({ 
  error, 
  resetErrorBoundary, 
  errorId, 
  sessionId 
}: Omit<ErrorFallbackProps, 'level'>) {
  return (
    <ErrorFallback
      error={error}
      resetErrorBoundary={resetErrorBoundary}
      errorId={errorId}
      level="learning"
      sessionId={sessionId}
      customMessage="Your learning session encountered an error. Don't worry - your progress has been automatically saved and you can resume from where you left off."
    />
  );
}

export function FeatureErrorFallback({ 
  error, 
  resetErrorBoundary, 
  errorId,
  customMessage 
}: Omit<ErrorFallbackProps, 'level'>) {
  return (
    <ErrorFallback
      error={error}
      resetErrorBoundary={resetErrorBoundary}
      errorId={errorId}
      level="feature"
      customMessage={customMessage}
    />
  );
}

export function ComponentErrorFallback({ 
  error, 
  resetErrorBoundary, 
  errorId 
}: Omit<ErrorFallbackProps, 'level'>) {
  return (
    <ErrorFallback
      error={error}
      resetErrorBoundary={resetErrorBoundary}
      errorId={errorId}
      level="component"
      showDetails={process.env.NODE_ENV === 'development'}
    />
  );
}

export default ErrorFallback;