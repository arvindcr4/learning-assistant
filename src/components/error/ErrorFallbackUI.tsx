/**
 * Error Fallback UI Components
 * Reusable UI components for error states
 */

import type { ReactNode } from 'react';
import React from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

/**
 * Props for error fallback components
 */
export interface ErrorFallbackProps {
  /** Error message to display */
  error?: Error;
  /** Function to retry/reset the error */
  resetError?: () => void;
  /** Error boundary level */
  level?: 'application' | 'feature' | 'component';
  /** Show detailed error information */
  showDetails?: boolean;
  /** Custom title for the error */
  title?: string;
  /** Custom description for the error */
  description?: string;
}

/**
 * Component-level error fallback
 * @param props - Error fallback props
 * @returns JSX element
 */
export const ComponentErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  showDetails = false,
  title = 'Component Error',
  description = 'This component encountered an error and could not render.'
}) => (
  <div className="border border-red-200 bg-red-50 p-4 rounded-md">
    <div className="flex items-start">
      <div className="flex-shrink-0">
        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="ml-3 flex-1">
        <h3 className="text-sm font-medium text-red-800">{title}</h3>
        <p className="mt-1 text-sm text-red-700">{description}</p>
        {showDetails && error && (
          <details className="mt-2">
            <summary className="text-sm text-red-600 cursor-pointer">
              Technical Details
            </summary>
            <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap overflow-auto max-h-32">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        {resetError && (
          <div className="mt-3">
            <Button
              onClick={resetError}
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  </div>
);

/**
 * Feature-level error fallback
 * @param props - Error fallback props
 * @returns JSX element
 */
export const FeatureErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  showDetails = false,
  title = 'Feature Unavailable',
  description = 'This feature is temporarily unavailable due to an error.'
}) => (
  <Card className="border-orange-200 bg-orange-50">
    <CardHeader>
      <CardTitle className="text-orange-800 flex items-center">
        <svg className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {title}
      </CardTitle>
      <CardDescription className="text-orange-700">
        {description}
      </CardDescription>
    </CardHeader>
    <CardContent>
      {showDetails && error && (
        <details className="mb-4">
          <summary className="text-sm text-orange-600 cursor-pointer font-medium">
            Error Details
          </summary>
          <pre className="mt-2 text-xs text-orange-600 whitespace-pre-wrap overflow-auto max-h-40 p-2 bg-orange-100 rounded">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>
      )}
      <div className="flex gap-2">
        {resetError && (
          <Button
            onClick={resetError}
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-100"
          >
            Retry Feature
          </Button>
        )}
        <Button
          onClick={() => window.location.reload()}
          variant="ghost"
          className="text-orange-600 hover:bg-orange-100"
        >
          Refresh Page
        </Button>
      </div>
    </CardContent>
  </Card>
);

/**
 * Application-level error fallback
 * @param props - Error fallback props
 * @returns JSX element
 */
export const ApplicationErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  showDetails = false,
  title = 'Application Error',
  description = 'The application encountered an unexpected error. Please try refreshing the page.'
}) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="max-w-md w-full">
      <Card className="border-red-200">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <CardTitle className="text-red-900">{title}</CardTitle>
          <CardDescription className="text-red-700">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showDetails && error && (
            <details className="mb-4">
              <summary className="text-sm text-red-600 cursor-pointer font-medium">
                Technical Information
              </summary>
              <div className="mt-2 p-3 bg-red-50 rounded border border-red-200">
                <pre className="text-xs text-red-600 whitespace-pre-wrap overflow-auto max-h-48">
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              </div>
            </details>
          )}
          <div className="flex flex-col gap-2">
            {resetError && (
              <Button
                onClick={resetError}
                className="w-full"
                variant="default"
              >
                Try Again
              </Button>
            )}
            <Button
              onClick={() => window.location.reload()}
              className="w-full"
              variant="outline"
            >
              Refresh Page
            </Button>
            <Button
              onClick={() => window.location.href = '/'}
              className="w-full"
              variant="ghost"
            >
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

/**
 * Generic error fallback that adapts based on level
 * @param props - Error fallback props
 * @returns JSX element
 */
export const ErrorFallback: React.FC<ErrorFallbackProps> = (props) => {
  const { level = 'component' } = props;

  switch (level) {
    case 'application':
      return <ApplicationErrorFallback {...props} />;
    case 'feature':
      return <FeatureErrorFallback {...props} />;
    case 'component':
    default:
      return <ComponentErrorFallback {...props} />;
  }
};