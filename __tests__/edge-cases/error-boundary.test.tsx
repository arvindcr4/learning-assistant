import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Mock error reporting service
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// Import components after mocking
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { AsyncErrorBoundary } from '@/components/error/AsyncErrorBoundary';
import { ErrorFallback } from '@/components/error/ErrorFallback';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockSentry = Sentry as jest.Mocked<typeof Sentry>;

// Test components that can throw errors
const ThrowError: React.FC<{ shouldThrow?: boolean; errorType?: string }> = ({ 
  shouldThrow = false, 
  errorType = 'render' 
}) => {
  if (shouldThrow) {
    if (errorType === 'render') {
      throw new Error('Test render error');
    } else if (errorType === 'type') {
      throw new TypeError('Test type error');
    } else if (errorType === 'reference') {
      throw new ReferenceError('Test reference error');
    }
  }
  return <div>Component working correctly</div>;
};

const AsyncThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = false }) => {
  React.useEffect(() => {
    if (shouldThrow) {
      setTimeout(() => {
        throw new Error('Async error');
      }, 100);
    }
  }, [shouldThrow]);

  return <div>Async component</div>;
};

const NetworkErrorComponent: React.FC<{ shouldFail?: boolean }> = ({ shouldFail = false }) => {
  const [data, setData] = React.useState<string>('');
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        if (shouldFail) {
          throw new Error('Network request failed');
        }
        setData('Data loaded successfully');
      } catch (err) {
        setError(err as Error);
        throw err; // Re-throw to trigger error boundary
      }
    };

    fetchData();
  }, [shouldFail]);

  if (error) {
    throw error;
  }

  return <div>{data}</div>;
};

describe('Error Boundary Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Error Boundary', () => {
    it('should catch and display render errors', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText(/try refreshing the page/i)).toBeInTheDocument();
    });

    it('should render children normally when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component working correctly')).toBeInTheDocument();
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('should log errors to monitoring service', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'React Error Boundary caught an error',
        expect.objectContaining({
          error: expect.any(Error),
          errorInfo: expect.any(Object),
        })
      );

      expect(mockSentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            component: 'ErrorBoundary',
          }),
        })
      );
    });

    it('should handle different error types', () => {
      const errorTypes = ['render', 'type', 'reference'];

      errorTypes.forEach((errorType) => {
        const { unmount } = render(
          <ErrorBoundary>
            <ThrowError shouldThrow={true} errorType={errorType} />
          </ErrorBoundary>
        );

        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        
        unmount();
      });

      expect(mockLogger.error).toHaveBeenCalledTimes(errorTypes.length);
    });

    it('should provide retry functionality', async () => {
      let shouldThrow = true;
      
      const RetryComponent = () => {
        const [key, setKey] = React.useState(0);
        
        return (
          <ErrorBoundary key={key}>
            <ThrowError shouldThrow={shouldThrow} />
            <button onClick={() => {
              shouldThrow = false;
              setKey(k => k + 1);
            }}>
              Retry
            </button>
          </ErrorBoundary>
        );
      };

      render(<RetryComponent />);

      // Error should be displayed
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      // Component should render successfully after retry
      await waitFor(() => {
        expect(screen.getByText('Component working correctly')).toBeInTheDocument();
      });
    });
  });

  describe('Async Error Boundary', () => {
    it('should catch asynchronous errors', async () => {
      render(
        <AsyncErrorBoundary>
          <AsyncThrowError shouldThrow={true} />
        </AsyncErrorBoundary>
      );

      // Initial render should be successful
      expect(screen.getByText('Async component')).toBeInTheDocument();

      // Wait for async error to be caught
      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      }, { timeout: 2000 });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Async error caught',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });

    it('should handle promise rejections', async () => {
      const PromiseRejectionComponent = () => {
        React.useEffect(() => {
          Promise.reject(new Error('Unhandled promise rejection'));
        }, []);

        return <div>Promise component</div>;
      };

      render(
        <AsyncErrorBoundary>
          <PromiseRejectionComponent />
        </AsyncErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      render(
        <AsyncErrorBoundary>
          <NetworkErrorComponent shouldFail={true} />
        </AsyncErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Network'),
        expect.any(Object)
      );
    });
  });

  describe('Error Fallback Component', () => {
    it('should display detailed error information in development', () => {
      const error = new Error('Test error message');
      const errorInfo = {
        componentStack: '\n    in TestComponent\n    in ErrorBoundary',
      };

      process.env.NODE_ENV = 'development';

      render(
        <ErrorFallback 
          error={error} 
          errorInfo={errorInfo}
          resetError={() => {}}
        />
      );

      expect(screen.getByText('Test error message')).toBeInTheDocument();
      expect(screen.getByText(/componentstack/i)).toBeInTheDocument();

      process.env.NODE_ENV = 'test';
    });

    it('should hide sensitive information in production', () => {
      const error = new Error('Sensitive database connection failed');
      const errorInfo = {
        componentStack: '\n    in DatabaseComponent\n    in App',
      };

      process.env.NODE_ENV = 'production';

      render(
        <ErrorFallback 
          error={error} 
          errorInfo={errorInfo}
          resetError={() => {}}
        />
      );

      expect(screen.queryByText('Sensitive database connection failed')).not.toBeInTheDocument();
      expect(screen.getByText(/unexpected error occurred/i)).toBeInTheDocument();

      process.env.NODE_ENV = 'test';
    });

    it('should provide reset functionality', () => {
      const mockReset = jest.fn();
      const error = new Error('Test error');

      render(
        <ErrorFallback 
          error={error} 
          errorInfo={{}}
          resetError={mockReset}
        />
      );

      const resetButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(resetButton);

      expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it('should handle missing error information gracefully', () => {
      render(
        <ErrorFallback 
          error={null as any} 
          errorInfo={{}}
          resetError={() => {}}
        />
      );

      expect(screen.getByText(/unknown error occurred/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Stress Testing', () => {
    it('should handle rapid successive errors', async () => {
      const RapidErrorComponent = () => {
        const [errorCount, setErrorCount] = React.useState(0);

        React.useEffect(() => {
          const interval = setInterval(() => {
            setErrorCount(count => {
              if (count < 5) {
                throw new Error(`Rapid error ${count + 1}`);
              }
              return count;
            });
          }, 50);

          return () => clearInterval(interval);
        }, []);

        return <div>Error count: {errorCount}</div>;
      };

      render(
        <ErrorBoundary>
          <RapidErrorComponent />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });

      // Should handle multiple errors gracefully
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle errors in event handlers', () => {
      const EventErrorComponent = () => {
        const handleClick = () => {
          throw new Error('Event handler error');
        };

        return (
          <button onClick={handleClick}>
            Click to throw error
          </button>
        );
      };

      render(
        <ErrorBoundary>
          <EventErrorComponent />
        </ErrorBoundary>
      );

      const button = screen.getByRole('button');
      
      // Event handler errors are not caught by error boundaries
      expect(() => fireEvent.click(button)).toThrow('Event handler error');
    });

    it('should handle memory-intensive operations that fail', async () => {
      const MemoryIntensiveComponent = () => {
        React.useEffect(() => {
          // Simulate memory-intensive operation that fails
          try {
            const largeArray = new Array(1000000).fill(0).map((_, i) => {
              if (i > 500000) {
                throw new Error('Memory operation failed');
              }
              return i;
            });
          } catch (error) {
            throw error;
          }
        }, []);

        return <div>Memory component</div>;
      };

      render(
        <ErrorBoundary>
          <MemoryIntensiveComponent />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });
    });

    it('should handle circular reference errors', () => {
      const CircularErrorComponent = () => {
        React.useEffect(() => {
          const obj: any = {};
          obj.self = obj;
          obj.toString = () => {
            throw new Error('Circular reference error');
          };
          
          JSON.stringify(obj); // This will throw
        }, []);

        return <div>Circular component</div>;
      };

      render(
        <ErrorBoundary>
          <CircularErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('should handle errors during component unmounting', () => {
      const UnmountErrorComponent = () => {
        React.useEffect(() => {
          return () => {
            throw new Error('Unmount error');
          };
        }, []);

        return <div>Unmount test component</div>;
      };

      const { unmount } = render(
        <ErrorBoundary>
          <UnmountErrorComponent />
        </ErrorBoundary>
      );

      // Unmounting should not break the error boundary
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Error Recovery Strategies', () => {
    it('should implement fallback rendering for specific components', () => {
      const FallbackComponent = ({ error }: { error: Error }) => (
        <div>
          <h2>Component Failed</h2>
          <p>The learning component encountered an error.</p>
          <p>You can continue using other features.</p>
        </div>
      );

      render(
        <ErrorBoundary fallback={FallbackComponent}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component Failed')).toBeInTheDocument();
      expect(screen.getByText(/continue using other features/i)).toBeInTheDocument();
    });

    it('should provide error context to child components', () => {
      const ErrorContext = React.createContext<{
        hasError: boolean;
        error: Error | null;
        retry: () => void;
      }>({
        hasError: false,
        error: null,
        retry: () => {},
      });

      const ErrorAwareComponent = () => {
        const { hasError, error } = React.useContext(ErrorContext);
        
        if (hasError) {
          return <div>Error detected: {error?.message}</div>;
        }
        
        return <div>No errors</div>;
      };

      const ErrorProvider = ({ children }: { children: React.ReactNode }) => {
        const [hasError, setHasError] = React.useState(false);
        const [error, setError] = React.useState<Error | null>(null);

        const retry = () => {
          setHasError(false);
          setError(null);
        };

        React.useEffect(() => {
          const handleError = (event: ErrorEvent) => {
            setHasError(true);
            setError(new Error(event.message));
          };

          window.addEventListener('error', handleError);
          return () => window.removeEventListener('error', handleError);
        }, []);

        return (
          <ErrorContext.Provider value={{ hasError, error, retry }}>
            {children}
          </ErrorContext.Provider>
        );
      };

      render(
        <ErrorProvider>
          <ErrorAwareComponent />
        </ErrorProvider>
      );

      expect(screen.getByText('No errors')).toBeInTheDocument();
    });

    it('should handle partial component failures gracefully', () => {
      const PartialFailureComponent = () => {
        const [workingFeatures] = React.useState(['feature1', 'feature2']);
        const [failedFeatures] = React.useState(['feature3']);

        return (
          <div>
            <h2>Application Status</h2>
            <div>
              <h3>Working Features:</h3>
              {workingFeatures.map(feature => (
                <div key={feature}>{feature} ✓</div>
              ))}
            </div>
            <div>
              <h3>Failed Features:</h3>
              {failedFeatures.map(feature => (
                <div key={feature}>{feature} ✗ (temporarily unavailable)</div>
              ))}
            </div>
          </div>
        );
      };

      render(
        <ErrorBoundary>
          <PartialFailureComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('feature1 ✓')).toBeInTheDocument();
      expect(screen.getByText('feature3 ✗ (temporarily unavailable)')).toBeInTheDocument();
    });
  });
});