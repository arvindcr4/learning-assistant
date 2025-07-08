/**
 * Error Reporter Service
 * Centralized error reporting and tracking service
 */

import type { ErrorInfo } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Error details interface for comprehensive error tracking
 */
export interface ErrorDetails {
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** React component stack */
  componentStack?: string;
  /** Error boundary that caught the error */
  errorBoundary?: string;
  /** Error timestamp */
  timestamp: number;
  /** Current URL when error occurred */
  url: string;
  /** User agent string */
  userAgent: string;
  /** User ID if available */
  userId?: string;
  /** Session ID if available */
  sessionId?: string;
}

/**
 * Singleton error reporter service for centralized error handling
 */
export class ErrorReporter {
  private static instance: ErrorReporter;
  private errors: ErrorDetails[] = [];
  private readonly maxErrors = 100;

  /**
   * Gets the singleton instance of ErrorReporter
   * @returns ErrorReporter instance
   */
  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }

  /**
   * Reports an error with detailed context
   * @param error - The error object
   * @param errorInfo - React error info
   * @param additionalContext - Additional context
   */
  reportError(
    error: Error,
    errorInfo?: ErrorInfo,
    additionalContext?: Record<string, unknown>
  ): void {
    const errorDetails: ErrorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
      ...additionalContext,
    };

    this.storeError(errorDetails);
    this.sendToSentry(error, errorInfo, additionalContext);
  }

  /**
   * Stores error in local storage for debugging
   * @param errorDetails - Error details to store
   */
  private storeError(errorDetails: ErrorDetails): void {
    this.errors.push(errorDetails);
    
    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Store in localStorage for debugging
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('error-history', JSON.stringify(this.errors));
      } catch {
        // Ignore localStorage errors
      }
    }
  }

  /**
   * Sends error to Sentry for remote tracking
   * @param error - The error object
   * @param errorInfo - React error info
   * @param additionalContext - Additional context
   */
  private sendToSentry(
    error: Error,
    errorInfo?: ErrorInfo,
    additionalContext?: Record<string, unknown>
  ): void {
    Sentry.withScope(scope => {
      if (errorInfo?.componentStack) {
        scope.setContext('react', {
          componentStack: errorInfo.componentStack,
        });
      }

      if (additionalContext) {
        scope.setContext('additional', additionalContext);
      }

      scope.setLevel('error');
      Sentry.captureException(error);
    });
  }

  /**
   * Gets the stored error history
   * @returns Array of error details
   */
  getErrorHistory(): readonly ErrorDetails[] {
    return [...this.errors];
  }

  /**
   * Clears the error history
   */
  clearErrorHistory(): void {
    this.errors = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('error-history');
    }
  }
}