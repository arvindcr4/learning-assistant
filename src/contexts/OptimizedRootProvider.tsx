'use client';

import React, { ReactNode, useEffect, Suspense, lazy } from 'react';
import { EnhancedErrorBoundary, ContextErrorBoundary } from '@/components/ErrorBoundary';
import { usePerformanceMonitoring, useRenderTracking } from '@/hooks/usePerformanceMonitoring';
import { composeProviders } from './OptimizedContext';

// Lazy load non-critical providers
const UIProvider = lazy(() => import('./UIContext').then(m => ({ default: m.UIProvider })));

// Import optimized providers
import { OptimizedAuthProvider } from './OptimizedAuthContext';
import { OptimizedLearningProvider } from './OptimizedLearningContext';

// Import remaining providers (to be optimized)
import { QuizProvider } from './QuizContext';
import { ChatProvider } from './ChatContext';
import { NotificationProvider } from './NotificationContext';
import { SyncProvider } from './SyncContext';

// Performance monitoring wrapper
const PerformanceWrapper = React.memo(function PerformanceWrapper({ children }: { children: ReactNode }) {
  useRenderTracking('PerformanceWrapper');
  const { startMonitoring } = usePerformanceMonitoring();

  useEffect(() => {
    startMonitoring();
    
    // Initialize global performance monitor
    if (typeof window !== 'undefined') {
      (window as any).__PERFORMANCE_MONITOR__ = {
        recordStateUpdate: (contextName: string, action: string, duration: number, payloadSize: number) => {
          console.log(`State Update - ${contextName}: ${action} (${duration.toFixed(2)}ms, ${payloadSize}B)`);
        },
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__PERFORMANCE_MONITOR__;
      }
    };
  }, [startMonitoring]);

  return <>{children}</>;
});

// Critical providers (loaded immediately)
const CriticalProviders = React.memo(function CriticalProviders({ children }: { children: ReactNode }) {
  useRenderTracking('CriticalProviders');
  
  return (
    <ContextErrorBoundary contextName="Auth">
      <OptimizedAuthProvider>
        <ContextErrorBoundary contextName="Notification">
          <NotificationProvider>
            <ContextErrorBoundary contextName="Learning">
              <OptimizedLearningProvider>
                {children}
              </OptimizedLearningProvider>
            </ContextErrorBoundary>
          </NotificationProvider>
        </ContextErrorBoundary>
      </OptimizedAuthProvider>
    </ContextErrorBoundary>
  );
});

// Non-critical providers (can be lazy loaded)
const NonCriticalProviders = React.memo(function NonCriticalProviders({ children }: { children: ReactNode }) {
  useRenderTracking('NonCriticalProviders');
  
  return (
    <ContextErrorBoundary contextName="Sync">
      <SyncProvider>
        <ContextErrorBoundary contextName="Quiz">
          <QuizProvider>
            <ContextErrorBoundary contextName="Chat">
              <ChatProvider>
                <Suspense fallback={<div>Loading UI...</div>}>
                  <ContextErrorBoundary contextName="UI">
                    <UIProvider>
                      {children}
                    </UIProvider>
                  </ContextErrorBoundary>
                </Suspense>
              </ChatProvider>
            </ContextErrorBoundary>
          </QuizProvider>
        </ContextErrorBoundary>
      </SyncProvider>
    </ContextErrorBoundary>
  );
});

// Loading fallback component
const ProviderLoading = React.memo(function ProviderLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Initializing application...</p>
      </div>
    </div>
  );
});

// Optimized root provider with progressive loading
export function OptimizedRootProvider({ children }: { children: ReactNode }) {
  useRenderTracking('OptimizedRootProvider');
  
  return (
    <EnhancedErrorBoundary 
      level="application" 
      name="RootProvider"
      maxRetries={3}
      showDetails={process.env.NODE_ENV === 'development'}
    >
      <PerformanceWrapper>
        <Suspense fallback={<ProviderLoading />}>
          <CriticalProviders>
            <NonCriticalProviders>
              {children}
            </NonCriticalProviders>
          </CriticalProviders>
        </Suspense>
      </PerformanceWrapper>
    </EnhancedErrorBoundary>
  );
}

// Feature-specific provider for selective loading
export function FeatureProvider({ 
  children, 
  features = ['auth', 'learning', 'quiz', 'chat', 'notifications', 'sync', 'ui'] 
}: { 
  children: ReactNode;
  features?: string[];
}) {
  useRenderTracking('FeatureProvider');
  
  // Build provider tree based on requested features
  const providers: React.ComponentType<{ children: ReactNode }>[] = [];
  
  if (features.includes('auth')) {
    providers.push(({ children }) => (
      <ContextErrorBoundary contextName="Auth">
        <OptimizedAuthProvider>{children}</OptimizedAuthProvider>
      </ContextErrorBoundary>
    ));
  }
  
  if (features.includes('notifications')) {
    providers.push(({ children }) => (
      <ContextErrorBoundary contextName="Notification">
        <NotificationProvider>{children}</NotificationProvider>
      </ContextErrorBoundary>
    ));
  }
  
  if (features.includes('learning')) {
    providers.push(({ children }) => (
      <ContextErrorBoundary contextName="Learning">
        <OptimizedLearningProvider>{children}</OptimizedLearningProvider>
      </ContextErrorBoundary>
    ));
  }
  
  if (features.includes('sync')) {
    providers.push(({ children }) => (
      <ContextErrorBoundary contextName="Sync">
        <SyncProvider>{children}</SyncProvider>
      </ContextErrorBoundary>
    ));
  }
  
  if (features.includes('quiz')) {
    providers.push(({ children }) => (
      <ContextErrorBoundary contextName="Quiz">
        <QuizProvider>{children}</QuizProvider>
      </ContextErrorBoundary>
    ));
  }
  
  if (features.includes('chat')) {
    providers.push(({ children }) => (
      <ContextErrorBoundary contextName="Chat">
        <ChatProvider>{children}</ChatProvider>
      </ContextErrorBoundary>
    ));
  }
  
  if (features.includes('ui')) {
    providers.push(({ children }) => (
      <Suspense fallback={<div>Loading UI...</div>}>
        <ContextErrorBoundary contextName="UI">
          <UIProvider>{children}</UIProvider>
        </ContextErrorBoundary>
      </Suspense>
    ));
  }

  const ComposedProvider = composeProviders(...providers);

  return (
    <EnhancedErrorBoundary 
      level="feature" 
      name="FeatureProvider"
      maxRetries={2}
    >
      <PerformanceWrapper>
        <ComposedProvider>
          {children}
        </ComposedProvider>
      </PerformanceWrapper>
    </EnhancedErrorBoundary>
  );
}

// Development tools wrapper (only in development)
const DevToolsWrapper = React.memo(function DevToolsWrapper({ children }: { children: ReactNode }) {
  useRenderTracking('DevToolsWrapper');
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Enhanced development tools
      (window as any).__LEARNING_ASSISTANT_DEV__ = {
        getState: () => {
          // Return state from all contexts
          console.log('Getting application state...');
          return {
            timestamp: new Date().toISOString(),
            contexts: {
              auth: 'Use useAuthUser(), useAuthStatus(), etc.',
              learning: 'Use useLearningCurrentPath(), useLearningStats(), etc.',
              // Add other contexts
            },
          };
        },
        clearStorage: () => {
          localStorage.clear();
          sessionStorage.clear();
          console.log('Storage cleared');
        },
        exportState: () => {
          const state = (window as any).__LEARNING_ASSISTANT_DEV__.getState();
          const blob = new Blob([JSON.stringify(state, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'learning-assistant-state.json';
          a.click();
          URL.revokeObjectURL(url);
        },
        performance: {
          start: () => {
            const monitor = (window as any).__PERFORMANCE_MONITOR__;
            if (monitor) {
              monitor.start();
              console.log('Performance monitoring started');
            }
          },
          stop: () => {
            const monitor = (window as any).__PERFORMANCE_MONITOR__;
            if (monitor) {
              monitor.stop();
              console.log('Performance monitoring stopped');
            }
          },
          export: () => {
            const monitor = (window as any).__PERFORMANCE_MONITOR__;
            if (monitor) {
              monitor.exportMetrics();
            }
          },
        },
      };

      console.log('🔧 Development tools loaded:');
      console.log('- __LEARNING_ASSISTANT_DEV__.getState() - Get current state');
      console.log('- __LEARNING_ASSISTANT_DEV__.clearStorage() - Clear all storage');
      console.log('- __LEARNING_ASSISTANT_DEV__.exportState() - Export state to JSON');
      console.log('- __LEARNING_ASSISTANT_DEV__.performance.start() - Start performance monitoring');
      console.log('- __LEARNING_ASSISTANT_DEV__.performance.stop() - Stop performance monitoring');
      console.log('- __LEARNING_ASSISTANT_DEV__.performance.export() - Export performance data');
    }

    return () => {
      if (process.env.NODE_ENV === 'development') {
        delete (window as any).__LEARNING_ASSISTANT_DEV__;
      }
    };
  }, []);

  return <>{children}</>;
});

// Enhanced root provider with development tools
export function EnhancedRootProvider({ children }: { children: ReactNode }) {
  useRenderTracking('EnhancedRootProvider');
  
  return (
    <OptimizedRootProvider>
      <DevToolsWrapper>
        {children}
      </DevToolsWrapper>
    </OptimizedRootProvider>
  );
}

// Context status hook for debugging
export function useContextStatus() {
  const [status, setStatus] = React.useState({
    auth: false,
    learning: false,
    ui: false,
    notifications: false,
    sync: false,
    quiz: false,
    chat: false,
  });

  React.useEffect(() => {
    const checkStatus = () => {
      try {
        // Check if contexts are available
        const newStatus = {
          auth: true, // These would check actual context availability
          learning: true,
          ui: true,
          notifications: true,
          sync: true,
          quiz: true,
          chat: true,
        };
        setStatus(newStatus);
      } catch (error) {
        console.error('Error checking context status:', error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  return status;
}

// Memory optimization helper
export function useMemoryOptimization() {
  const [memoryPressure, setMemoryPressure] = React.useState(false);

  React.useEffect(() => {
    const checkMemoryPressure = () => {
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        const usageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
        setMemoryPressure(usageRatio > 0.8);
      }
    };

    const interval = setInterval(checkMemoryPressure, 5000);
    return () => clearInterval(interval);
  }, []);

  const forceGarbageCollection = React.useCallback(() => {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
      console.log('Forced garbage collection');
    }
  }, []);

  return { memoryPressure, forceGarbageCollection };
}

// Export optimized providers as default
export default OptimizedRootProvider;