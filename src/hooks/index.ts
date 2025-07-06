// Export all hooks for easy importing
export { useLocalStorage } from './useLocalStorage';
export { useDebounce } from './useDebounce';
export {
  useLocalStorage as useEnhancedLocalStorage,
  useSessionStorage,
  useIndexedDB,
  useCachedStorage,
  useStorageEvent,
  useStorageQuota,
} from './useStorage';
export {
  useThrottle,
  useMemoizedComputation,
  useLazyInitialization,
  useVirtualScroll,
  useIntersectionObserver,
  usePerformanceMonitor,
  useRenderPerformance,
  useBatchedUpdates,
  useOptimizedRerender,
  useLifecycleTracker,
  useListOptimization,
  useLazyImage,
  useSearchOptimization,
} from './usePerformance';