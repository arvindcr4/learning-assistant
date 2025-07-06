'use client';

import React, { ReactNode, useEffect } from 'react';
import { AuthProvider } from './AuthContext';
import { LearningProvider } from './LearningContext';
import { QuizProvider } from './QuizContext';
import { ChatProvider } from './ChatContext';
import { NotificationProvider } from './NotificationContext';
import { SyncProvider } from './SyncContext';
import { UIProvider } from './UIContext';
import { usePerformanceMonitor } from '@/hooks/usePerformance';

// Error boundary for the entire application
class StateErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('State management error:', error, errorInfo);
    
    // Here you could send error reports to a logging service
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: false,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-red-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              An error occurred in the application state management.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Performance monitoring wrapper
function PerformanceWrapper({ children }: { children: ReactNode }) {
  const { startMeasure, endMeasure, getMetrics } = usePerformanceMonitor();

  useEffect(() => {
    startMeasure('app-initialization');
    
    const timeout = setTimeout(() => {
      endMeasure('app-initialization');
      const metrics = getMetrics();
      console.log('App initialization metrics:', metrics);
    }, 100);

    return () => clearTimeout(timeout);
  }, [startMeasure, endMeasure, getMetrics]);

  return <>{children}</>;
}

// Main root provider component
export function RootProvider({ children }: { children: ReactNode }) {
  return (
    <StateErrorBoundary>
      <PerformanceWrapper>
        <AuthProvider>
          <NotificationProvider>
            <SyncProvider>
              <LearningProvider>
                <QuizProvider>
                  <ChatProvider>
                    <UIProvider>
                      {children}
                    </UIProvider>
                  </ChatProvider>
                </QuizProvider>
              </LearningProvider>
            </SyncProvider>
          </NotificationProvider>
        </AuthProvider>
      </PerformanceWrapper>
    </StateErrorBoundary>
  );
}

// Combined context hooks for easier access
export function useAppState() {
  const auth = React.useContext(require('./AuthContext').AuthContext);
  const learning = React.useContext(require('./LearningContext').LearningContext);
  const quiz = React.useContext(require('./QuizContext').QuizContext);
  const chat = React.useContext(require('./ChatContext').ChatContext);
  const notifications = React.useContext(require('./NotificationContext').NotificationContext);
  const sync = React.useContext(require('./SyncContext').SyncContext);
  const ui = React.useContext(require('./UIContext').UIContext);

  return {
    auth,
    learning,
    quiz,
    chat,
    notifications,
    sync,
    ui,
  };
}

// Helper hook to check if all contexts are loaded
export function useContextsLoaded() {
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    // Check if all required contexts are available
    const checkContexts = () => {
      try {
        const contexts = useAppState();
        const allLoaded = Object.values(contexts).every(context => context !== undefined);
        setIsLoaded(allLoaded);
      } catch (error) {
        console.error('Error checking contexts:', error);
        setIsLoaded(false);
      }
    };

    const timeout = setTimeout(checkContexts, 100);
    return () => clearTimeout(timeout);
  }, []);

  return isLoaded;
}

// Development tools wrapper (only in development)
function DevToolsWrapper({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Add development tools to window object for debugging
      (window as any).__LEARNING_ASSISTANT_DEV__ = {
        getState: () => {
          try {
            return useAppState();
          } catch (error) {
            console.error('Failed to get state:', error);
            return null;
          }
        },
        clearStorage: () => {
          localStorage.clear();
          sessionStorage.clear();
          console.log('Storage cleared');
        },
        exportState: () => {
          const state = (window as any).__LEARNING_ASSISTANT_DEV__.getState();
          if (state) {
            const blob = new Blob([JSON.stringify(state, null, 2)], {
              type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'learning-assistant-state.json';
            a.click();
            URL.revokeObjectURL(url);
          }
        },
      };

      console.log('Development tools loaded. Available commands:');
      console.log('- __LEARNING_ASSISTANT_DEV__.getState() - Get current state');
      console.log('- __LEARNING_ASSISTANT_DEV__.clearStorage() - Clear all storage');
      console.log('- __LEARNING_ASSISTANT_DEV__.exportState() - Export state to JSON');
    }

    return () => {
      if (process.env.NODE_ENV === 'development') {
        delete (window as any).__LEARNING_ASSISTANT_DEV__;
      }
    };
  }, []);

  return <>{children}</>;
}

// Enhanced root provider with development tools
export function EnhancedRootProvider({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <DevToolsWrapper>
        {children}
      </DevToolsWrapper>
    </RootProvider>
  );
}

// Provider for specific feature areas (optional)
export function FeatureProvider({ 
  children, 
  features = ['auth', 'learning', 'quiz', 'chat', 'notifications', 'sync', 'ui'] 
}: { 
  children: ReactNode;
  features?: string[];
}) {
  let provider = <>{children}</>;

  if (features.includes('ui')) {
    provider = <UIProvider>{provider}</UIProvider>;
  }

  if (features.includes('chat')) {
    provider = <ChatProvider>{provider}</ChatProvider>;
  }

  if (features.includes('quiz')) {
    provider = <QuizProvider>{provider}</QuizProvider>;
  }

  if (features.includes('learning')) {
    provider = <LearningProvider>{provider}</LearningProvider>;
  }

  if (features.includes('sync')) {
    provider = <SyncProvider>{provider}</SyncProvider>;
  }

  if (features.includes('notifications')) {
    provider = <NotificationProvider>{provider}</NotificationProvider>;
  }

  if (features.includes('auth')) {
    provider = <AuthProvider>{provider}</AuthProvider>;
  }

  return (
    <StateErrorBoundary>
      <PerformanceWrapper>
        {provider}
      </PerformanceWrapper>
    </StateErrorBoundary>
  );
}

export default RootProvider;