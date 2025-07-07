'use client';

import React, { useCallback, useEffect, ReactNode, useMemo } from 'react';
import { 
  LearningState, 
  LearningAction, 
  LearningPath, 
  StudySession, 
  Progress, 
  LearningProfile, 
  PaceProfile, 
  LearningAnalytics 
} from '@/types';
import { useOptimizedStorage } from '@/hooks/useOptimizedStorage';
import { useStateUpdateTracking } from '@/hooks/usePerformanceMonitoring';
import { 
  createOptimizedContext, 
  createOptimizedProvider, 
  useMemoizedContextValue,
  ContextErrorBoundary,
  useBatchedDispatch
} from './OptimizedContext';

// Initial state with proper typing
const initialState: LearningState = {
  currentPath: null,
  allPaths: [],
  activeSession: null,
  progress: [],
  learningProfile: null,
  paceProfile: null,
  analytics: null,
  isLoading: false,
  error: null,
};

// Immutable reducer with performance tracking
function learningReducer(state: LearningState, action: LearningAction): LearningState {
  const startTime = performance.now();
  
  let newState: LearningState;
  
  switch (action.type) {
    case 'SET_CURRENT_PATH':
      newState = {
        ...state,
        currentPath: action.payload,
      };
      break;

    case 'SET_ALL_PATHS':
      newState = {
        ...state,
        allPaths: action.payload,
      };
      break;

    case 'SET_ACTIVE_SESSION':
      newState = {
        ...state,
        activeSession: action.payload,
      };
      break;

    case 'UPDATE_PROGRESS':
      // Optimized progress update - only update if different
      if (JSON.stringify(state.progress) !== JSON.stringify(action.payload)) {
        newState = {
          ...state,
          progress: action.payload,
        };
      } else {
        newState = state;
      }
      break;

    case 'ADD_PROGRESS':
      // Optimized progress addition - check for duplicates
      const existingProgressIndex = state.progress.findIndex(
        p => p.moduleId === action.payload.moduleId
      );
      
      if (existingProgressIndex >= 0) {
        newState = {
          ...state,
          progress: [
            ...state.progress.slice(0, existingProgressIndex),
            action.payload,
            ...state.progress.slice(existingProgressIndex + 1),
          ],
        };
      } else {
        newState = {
          ...state,
          progress: [...state.progress, action.payload],
        };
      }
      break;

    case 'SET_LEARNING_PROFILE':
      newState = {
        ...state,
        learningProfile: action.payload,
      };
      break;

    case 'SET_PACE_PROFILE':
      newState = {
        ...state,
        paceProfile: action.payload,
      };
      break;

    case 'SET_ANALYTICS':
      newState = {
        ...state,
        analytics: action.payload,
      };
      break;

    case 'SET_LOADING':
      newState = {
        ...state,
        isLoading: action.payload,
      };
      break;

    case 'SET_ERROR':
      newState = {
        ...state,
        error: action.payload,
      };
      break;

    case 'RESET':
      newState = initialState;
      break;

    default:
      newState = state;
  }

  // Performance tracking
  const duration = performance.now() - startTime;
  const payloadSize = JSON.stringify(action.payload || {}).length;
  
  if (typeof window !== 'undefined') {
    // Track state update performance
    const monitor = (window as any).__PERFORMANCE_MONITOR__;
    if (monitor) {
      monitor.recordStateUpdate('LearningContext', action.type, duration, payloadSize);
    }
  }

  return newState;
}

// Create optimized context
const { Context: LearningContext, useContextSelector, useContextDispatch } = createOptimizedContext<LearningState>();

// Create optimized provider
const LearningProviderCore = createOptimizedProvider(initialState, learningReducer, LearningContext);

// Enhanced provider with side effects and persistence
export function OptimizedLearningProvider({ children }: { children: ReactNode }) {
  return (
    <ContextErrorBoundary>
      <LearningProviderCore>
        <LearningSideEffectsProvider>
          {children}
        </LearningSideEffectsProvider>
      </LearningProviderCore>
    </ContextErrorBoundary>
  );
}

// Side effects provider (separate from state management)
function LearningSideEffectsProvider({ children }: { children: ReactNode }) {
  const dispatch = useContextDispatch();
  const batchedDispatch = useBatchedDispatch(dispatch);
  const { trackStateUpdate } = useStateUpdateTracking('LearningContext');
  
  // Optimized storage with better serialization
  const [persistedLearning, setPersistedLearning] = useOptimizedStorage('learning', {
    currentPath: null,
    progress: [],
    learningProfile: null,
    paceProfile: null,
  });

  // Selectors for specific state slices
  const currentPath = useContextSelector(state => state.currentPath);
  const progress = useContextSelector(state => state.progress);
  const learningProfile = useContextSelector(state => state.learningProfile);
  const paceProfile = useContextSelector(state => state.paceProfile);

  // Initialize learning state from storage
  useEffect(() => {
    if (persistedLearning.currentPath) {
      dispatch({ type: 'SET_CURRENT_PATH', payload: persistedLearning.currentPath });
    }
    if (persistedLearning.progress?.length > 0) {
      dispatch({ type: 'UPDATE_PROGRESS', payload: persistedLearning.progress });
    }
    if (persistedLearning.learningProfile) {
      dispatch({ type: 'SET_LEARNING_PROFILE', payload: persistedLearning.learningProfile });
    }
    if (persistedLearning.paceProfile) {
      dispatch({ type: 'SET_PACE_PROFILE', payload: persistedLearning.paceProfile });
    }
  }, [persistedLearning, dispatch]);

  // Optimized persistence - only save when data actually changes
  useEffect(() => {
    const newPersistedData = {
      currentPath,
      progress,
      learningProfile,
      paceProfile,
    };
    
    // Only update if data has actually changed
    if (JSON.stringify(newPersistedData) !== JSON.stringify(persistedLearning)) {
      setPersistedLearning(newPersistedData);
    }
  }, [currentPath, progress, learningProfile, paceProfile, persistedLearning, setPersistedLearning]);

  return <>{children}</>;
}

// Optimized hooks with selectors
export function useLearningCurrentPath() {
  return useContextSelector(state => state.currentPath);
}

export function useLearningAllPaths() {
  return useContextSelector(state => state.allPaths);
}

export function useLearningActiveSession() {
  return useContextSelector(state => state.activeSession);
}

export function useLearningProgress() {
  return useContextSelector(state => state.progress);
}

export function useLearningProfile() {
  return useContextSelector(state => state.learningProfile);
}

export function useLearningPaceProfile() {
  return useContextSelector(state => state.paceProfile);
}

export function useLearningAnalytics() {
  return useContextSelector(state => state.analytics);
}

export function useLearningLoading() {
  return useContextSelector(state => state.isLoading);
}

export function useLearningError() {
  return useContextSelector(state => state.error);
}

// Computed selectors for derived state
export function useLearningStats() {
  return useContextSelector(state => {
    const totalPaths = state.allPaths.length;
    const completedPaths = state.allPaths.filter(path => path.progress === 100).length;
    const totalProgress = state.progress.length;
    const completedProgress = state.progress.filter(p => p.completed).length;
    const averageScore = state.progress.reduce((sum, p) => sum + (p.score || 0), 0) / totalProgress || 0;
    
    return {
      totalPaths,
      completedPaths,
      totalProgress,
      completedProgress,
      averageScore,
      completionRate: totalProgress > 0 ? (completedProgress / totalProgress) * 100 : 0,
    };
  });
}

export function useLearningRecommendations() {
  return useContextSelector(state => {
    if (!state.analytics) return [];
    return state.analytics.recommendations || [];
  });
}

// Actions hook with optimized API calls
export function useLearningActions() {
  const dispatch = useContextDispatch();
  const batchedDispatch = useBatchedDispatch(dispatch);
  
  return useMemo(() => ({
    setCurrentPath: (path: LearningPath | null) => {
      dispatch({ type: 'SET_CURRENT_PATH', payload: path });
    },
    
    loadAllPaths: async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const paths = await mockLoadPaths();
        dispatch({ type: 'SET_ALL_PATHS', payload: paths });
      } catch (error) {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: error instanceof Error ? error.message : 'Failed to load paths' 
        });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    
    startSession: async (moduleId: string) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const session = await mockStartSession(moduleId);
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: session });
      } catch (error) {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: error instanceof Error ? error.message : 'Failed to start session' 
        });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    
    endSession: async () => {
      const state = (dispatch as any).getState?.();
      if (state?.activeSession) {
        const endTime = new Date();
        const duration = Math.round((endTime.getTime() - state.activeSession.startTime.getTime()) / 60000);
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: null });
      }
    },
    
    updateProgress: async (moduleId: string, completed: boolean, score?: number) => {
      try {
        const progress = await mockUpdateProgress(moduleId, completed, score);
        dispatch({ type: 'ADD_PROGRESS', payload: progress });
      } catch (error) {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: error instanceof Error ? error.message : 'Failed to update progress' 
        });
      }
    },
    
    batchUpdateProgress: async (updates: Array<{ moduleId: string; completed: boolean; score?: number }>) => {
      try {
        const progressUpdates = await Promise.all(
          updates.map(({ moduleId, completed, score }) => 
            mockUpdateProgress(moduleId, completed, score)
          )
        );
        
        // Batch dispatch for better performance
        progressUpdates.forEach(progress => {
          batchedDispatch({ type: 'ADD_PROGRESS', payload: progress });
        });
      } catch (error) {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: error instanceof Error ? error.message : 'Failed to batch update progress' 
        });
      }
    },
    
    loadLearningProfile: async (userId: string) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const profile = await mockLoadLearningProfile(userId);
        dispatch({ type: 'SET_LEARNING_PROFILE', payload: profile });
      } catch (error) {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: error instanceof Error ? error.message : 'Failed to load learning profile' 
        });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    
    updateLearningProfile: async (profileData: Partial<LearningProfile>) => {
      const currentProfile = (dispatch as any).getState?.()?.learningProfile;
      if (currentProfile) {
        const updatedProfile = { ...currentProfile, ...profileData, updatedAt: new Date() };
        dispatch({ type: 'SET_LEARNING_PROFILE', payload: updatedProfile });
      }
    },
    
    loadPaceProfile: async (userId: string) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const profile = await mockLoadPaceProfile(userId);
        dispatch({ type: 'SET_PACE_PROFILE', payload: profile });
      } catch (error) {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: error instanceof Error ? error.message : 'Failed to load pace profile' 
        });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    
    updatePaceProfile: async (profileData: Partial<PaceProfile>) => {
      const currentProfile = (dispatch as any).getState?.()?.paceProfile;
      if (currentProfile) {
        const updatedProfile = { ...currentProfile, ...profileData, lastUpdated: new Date() };
        dispatch({ type: 'SET_PACE_PROFILE', payload: updatedProfile });
      }
    },
    
    loadAnalytics: async (userId: string, timeRange?: { start: Date; end: Date }) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const analytics = await mockLoadAnalytics(userId, timeRange);
        dispatch({ type: 'SET_ANALYTICS', payload: analytics });
      } catch (error) {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: error instanceof Error ? error.message : 'Failed to load analytics' 
        });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    
    clearError: () => {
      dispatch({ type: 'SET_ERROR', payload: null });
    },
    
    reset: () => {
      dispatch({ type: 'RESET' });
    },
  }), [dispatch, batchedDispatch]);
}

// Combined hook for backward compatibility (with performance warning)
export function useOptimizedLearning() {
  const currentPath = useLearningCurrentPath();
  const allPaths = useLearningAllPaths();
  const activeSession = useLearningActiveSession();
  const progress = useLearningProgress();
  const learningProfile = useLearningProfile();
  const paceProfile = useLearningPaceProfile();
  const analytics = useLearningAnalytics();
  const isLoading = useLearningLoading();
  const error = useLearningError();
  const actions = useLearningActions();
  const stats = useLearningStats();

  return useMemoizedContextValue({
    state: {
      currentPath,
      allPaths,
      activeSession,
      progress,
      learningProfile,
      paceProfile,
      analytics,
      isLoading,
      error,
    },
    stats,
    ...actions,
  }, [
    currentPath, allPaths, activeSession, progress, learningProfile, 
    paceProfile, analytics, isLoading, error, actions, stats
  ]);
}

// Mock API functions (replace with actual API calls)
const mockLoadPaths = async (): Promise<LearningPath[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return [
    {
      id: '1',
      title: 'JavaScript Fundamentals',
      description: 'Learn the basics of JavaScript programming',
      difficulty: 'beginner',
      estimatedDuration: 480,
      topics: ['Variables', 'Functions', 'Objects', 'Arrays'],
      modules: [],
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      title: 'React Development',
      description: 'Build modern web applications with React',
      difficulty: 'intermediate',
      estimatedDuration: 720,
      topics: ['Components', 'State', 'Props', 'Hooks'],
      modules: [],
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
};

const mockStartSession = async (moduleId: string): Promise<StudySession> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return {
    id: `session-${Date.now()}`,
    userId: '1',
    moduleId,
    startTime: new Date(),
    duration: 0,
    completed: false,
  };
};

const mockUpdateProgress = async (moduleId: string, completed: boolean, score?: number): Promise<Progress> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return {
    userId: '1',
    pathId: '1',
    moduleId,
    completed,
    score,
    timeSpent: 30,
    lastAccessed: new Date(),
  };
};

const mockLoadLearningProfile = async (userId: string): Promise<LearningProfile> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  return {
    id: '1',
    userId,
    styles: [],
    dominantStyle: 'visual' as any,
    isMultimodal: false,
    assessmentHistory: [],
    behavioralIndicators: [],
    adaptationLevel: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

const mockLoadPaceProfile = async (userId: string): Promise<PaceProfile> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  return {
    id: '1',
    userId,
    currentPace: 2.5,
    optimalPace: 3.0,
    comprehensionRate: 85,
    retentionRate: 80,
    difficultyAdjustment: 1.0,
    fatigueLevel: 20,
    adaptationHistory: [],
    lastUpdated: new Date(),
  };
};

const mockLoadAnalytics = async (userId: string, timeRange?: { start: Date; end: Date }): Promise<LearningAnalytics> => {
  await new Promise(resolve => setTimeout(resolve, 600));
  return {
    id: '1',
    userId,
    timeRange: timeRange || { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() },
    overallProgress: {
      totalTimeSpent: 300,
      contentCompleted: 15,
      averageScore: 87,
      completionRate: 75,
      retentionRate: 82,
      streakDays: 5,
      goalsAchieved: 3,
      totalGoals: 5,
    },
    styleEffectiveness: [],
    paceAnalysis: {
      averagePace: 2.5,
      optimalPace: 3.0,
      paceConsistency: 85,
      fatiguePattern: {
        onsetTime: 45,
        recoveryTime: 10,
        indicators: ['decreased_accuracy', 'slower_response'],
        severity: 'medium',
      },
      peakPerformanceTime: '10:00',
      recommendedBreaks: 2,
    },
    contentEngagement: [],
    performanceTrends: [],
    recommendations: [],
    predictions: [],
    generatedAt: new Date(),
  };
};

// Legacy compatibility
export const LearningProvider = OptimizedLearningProvider;
export const useLearning = useOptimizedLearning;