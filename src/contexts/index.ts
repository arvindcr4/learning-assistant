// Export optimized contexts and their hooks (preferred)
export { 
  OptimizedAuthProvider as AuthProvider,
  useOptimizedAuth as useAuth,
  useAuthUser,
  useAuthToken,
  useAuthLoading,
  useAuthError,
  useAuthStatus,
  useAuthActions
} from './OptimizedAuthContext';

export { 
  OptimizedLearningProvider as LearningProvider,
  useOptimizedLearning as useLearning,
  useLearningCurrentPath,
  useLearningAllPaths,
  useLearningActiveSession,
  useLearningProgress,
  useLearningProfile,
  useLearningPaceProfile,
  useLearningAnalytics,
  useLearningLoading,
  useLearningError,
  useLearningStats,
  useLearningRecommendations,
  useLearningActions
} from './OptimizedLearningContext';

// Export legacy contexts for backward compatibility
export { QuizProvider, useQuiz } from './QuizContext';
export { ChatProvider, useChat } from './ChatContext';
export { NotificationProvider, useNotifications, withNotifications } from './NotificationContext';
export { SyncProvider, useSync, withSync } from './SyncContext';
export { UIProvider, useUI, withUI } from './UIContext';

// Export optimized root providers (preferred)
export { 
  OptimizedRootProvider as RootProvider,
  EnhancedRootProvider, 
  FeatureProvider,
  useContextStatus,
  useMemoryOptimization
} from './OptimizedRootProvider';

// Export optimization utilities
export {
  createOptimizedContext,
  createOptimizedProvider,
  useMemoizedContextValue,
  composeProviders,
  useContextPerformance,
  useBatchedDispatch,
  ContextErrorBoundary
} from './OptimizedContext';

// Export performance monitoring
export { useOptimizedStorage, useBatchedStorage, useStoragePerformance } from '../hooks/useOptimizedStorage';
export { 
  usePerformanceMonitoring,
  useRenderTracking,
  useInteractionTracking,
  useStateUpdateTracking,
  useMemoryLeakDetection,
  PerformanceDashboard
} from '../hooks/usePerformanceMonitoring';

// Export memory leak prevention
export {
  useMemoryLeakPrevention,
  useSafeTimeout,
  useSafeInterval,
  useSafeEventListener,
  useSafeIntersectionObserver,
  useMemoryPressureMonitoring,
  MemoryLeakTracker
} from '../hooks/useMemoryLeakPrevention';

// Export React optimizations
export { ReactOptimizations } from '../utils/reactOptimizations';

// Legacy exports (deprecated - use individual hooks for better performance)
export { useAppState, useContextsLoaded } from './RootProvider';
export { AppProvider, useApp } from './AppContext';