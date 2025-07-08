'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry in production
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
    
    // Log to console for debugging
    console.error('Global error caught:', error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Something went wrong!
            </h1>
            <p className="text-gray-600 mb-6">
              We're sorry, but something unexpected happened. This error has been logged and we're working to fix it.
            </p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={reset}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Try Again
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Go to Home
            </button>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Error Details (Development Only)
              </summary>
              <pre className="mt-2 text-xs bg-gray-100 p-4 rounded overflow-auto text-red-600">
                {error.message}
                {error.stack && (
                  <>
                    {'\n\nStack trace:\n'}
                    {error.stack}
                  </>
                )}
              </pre>
            </details>
          )}
        </div>
      </body>
    </html>
  );
}