'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';

import type { LearningState, LearningAction, LearningPath, StudySession, Progress, LearningProfile, PaceProfile, LearningAnalytics } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';

// Initial state
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

// Reducer function
function learningReducer(state: LearningState, action: LearningAction): LearningState {
  switch (action.type) {
    case 'SET_CURRENT_PATH':
      return {
        ...state,
        currentPath: action.payload,
      };

    case 'SET_ALL_PATHS':
      return {
        ...state,
        allPaths: action.payload,
      };

    case 'SET_ACTIVE_SESSION':
      return {
        ...state,
        activeSession: action.payload,
      };

    case 'UPDATE_PROGRESS':
      return {
        ...state,
        progress: action.payload,
      };

    case 'SET_LEARNING_PROFILE':
      return {
        ...state,
        learningProfile: action.payload,
      };

    case 'SET_PACE_PROFILE':
      return {
        ...state,
        paceProfile: action.payload,
      };

    case 'SET_ANALYTICS':
      return {
        ...state,
        analytics: action.payload,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// Context type
interface LearningContextType {
  state: LearningState;
  dispatch: React.Dispatch<LearningAction>;
  setCurrentPath: (path: LearningPath | null) => void;
  loadAllPaths: () => Promise<void>;
  startSession: (moduleId: string) => Promise<void>;
  endSession: () => Promise<void>;
  updateProgress: (moduleId: string, completed: boolean, score?: number) => Promise<void>;
  loadLearningProfile: (userId: string) => Promise<void>;
  updateLearningProfile: (profile: Partial<LearningProfile>) => Promise<void>;
  loadPaceProfile: (userId: string) => Promise<void>;
  updatePaceProfile: (profile: Partial<PaceProfile>) => Promise<void>;
  loadAnalytics: (userId: string, timeRange?: { start: Date; end: Date }) => Promise<void>;
  clearError: () => void;
}

const LearningContext = createContext<LearningContextType | undefined>(undefined);

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

// Provider component
export function LearningProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(learningReducer, initialState);
  const [persistedLearning, setPersistedLearning] = useLocalStorage('learning', {
    currentPath: null,
    progress: [],
    learningProfile: null,
    paceProfile: null,
  });

  // Initialize learning state from localStorage
  useEffect(() => {
    if (persistedLearning.currentPath) {
      dispatch({ type: 'SET_CURRENT_PATH', payload: persistedLearning.currentPath });
    }
    if (persistedLearning.progress) {
      dispatch({ type: 'UPDATE_PROGRESS', payload: persistedLearning.progress });
    }
    if (persistedLearning.learningProfile) {
      dispatch({ type: 'SET_LEARNING_PROFILE', payload: persistedLearning.learningProfile });
    }
    if (persistedLearning.paceProfile) {
      dispatch({ type: 'SET_PACE_PROFILE', payload: persistedLearning.paceProfile });
    }
  }, [persistedLearning]);

  // Persist learning state changes
  useEffect(() => {
    setPersistedLearning({
      currentPath: state.currentPath,
      progress: state.progress,
      learningProfile: state.learningProfile,
      paceProfile: state.paceProfile,
    });
  }, [state.currentPath, state.progress, state.learningProfile, state.paceProfile, setPersistedLearning]);

  const setCurrentPath = useCallback((path: LearningPath | null) => {
    dispatch({ type: 'SET_CURRENT_PATH', payload: path });
  }, []);

  const loadAllPaths = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const paths = await mockLoadPaths();
      dispatch({ type: 'SET_ALL_PATHS', payload: paths });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load paths' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const startSession = useCallback(async (moduleId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const session = await mockStartSession(moduleId);
      dispatch({ type: 'SET_ACTIVE_SESSION', payload: session });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to start session' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const endSession = useCallback(async () => {
    if (state.activeSession) {
      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - state.activeSession.startTime.getTime()) / 60000);
      const completedSession = {
        ...state.activeSession,
        endTime,
        duration,
        completed: true,
      };
      dispatch({ type: 'SET_ACTIVE_SESSION', payload: null });
      // Here you would typically save the session to the backend
    }
  }, [state.activeSession]);

  const updateProgress = useCallback(async (moduleId: string, completed: boolean, score?: number) => {
    try {
      const progress = await mockUpdateProgress(moduleId, completed, score);
      const updatedProgress = [...state.progress.filter(p => p.moduleId !== moduleId), progress];
      dispatch({ type: 'UPDATE_PROGRESS', payload: updatedProgress });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to update progress' });
    }
  }, [state.progress]);

  const loadLearningProfile = useCallback(async (userId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const profile = await mockLoadLearningProfile(userId);
      dispatch({ type: 'SET_LEARNING_PROFILE', payload: profile });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load learning profile' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const updateLearningProfile = useCallback(async (profileData: Partial<LearningProfile>) => {
    if (state.learningProfile) {
      const updatedProfile = { ...state.learningProfile, ...profileData, updatedAt: new Date() };
      dispatch({ type: 'SET_LEARNING_PROFILE', payload: updatedProfile });
      // Here you would typically save to the backend
    }
  }, [state.learningProfile]);

  const loadPaceProfile = useCallback(async (userId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const profile = await mockLoadPaceProfile(userId);
      dispatch({ type: 'SET_PACE_PROFILE', payload: profile });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load pace profile' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const updatePaceProfile = useCallback(async (profileData: Partial<PaceProfile>) => {
    if (state.paceProfile) {
      const updatedProfile = { ...state.paceProfile, ...profileData, lastUpdated: new Date() };
      dispatch({ type: 'SET_PACE_PROFILE', payload: updatedProfile });
      // Here you would typically save to the backend
    }
  }, [state.paceProfile]);

  const loadAnalytics = useCallback(async (userId: string, timeRange?: { start: Date; end: Date }) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const analytics = await mockLoadAnalytics(userId, timeRange);
      dispatch({ type: 'SET_ANALYTICS', payload: analytics });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load analytics' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  const value: LearningContextType = {
    state,
    dispatch,
    setCurrentPath,
    loadAllPaths,
    startSession,
    endSession,
    updateProgress,
    loadLearningProfile,
    updateLearningProfile,
    loadPaceProfile,
    updatePaceProfile,
    loadAnalytics,
    clearError,
  };

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

// Hook to use the learning context
export function useLearning() {
  const context = useContext(LearningContext);
  if (context === undefined) {
    throw new Error('useLearning must be used within a LearningProvider');
  }
  return context;
}