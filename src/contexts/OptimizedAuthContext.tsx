'use client';

import React, { useCallback, useEffect, ReactNode, useRef } from 'react';
import { AuthState, AuthAction, User } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { 
  createOptimizedContext, 
  createOptimizedProvider, 
  useMemoizedContextValue,
  ContextErrorBoundary
} from './OptimizedContext';

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  token: null,
  refreshToken: null,
  sessionExpiry: null,
};

// Immutable reducer function
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        error: null,
      };

    case 'LOGIN_FAILURE':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        token: null,
        refreshToken: null,
        sessionExpiry: null,
        error: action.payload,
      };

    case 'LOGOUT':
      return {
        ...initialState,
      };

    case 'REFRESH_TOKEN_SUCCESS':
      return {
        ...state,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        error: null,
      };

    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}

// Create optimized context
const { Context: AuthContext, useContextSelector, useContextDispatch } = createOptimizedContext<AuthState>();

// Create optimized provider
const AuthProviderCore = createOptimizedProvider(initialState, authReducer, AuthContext);

// Enhanced provider with side effects
export function OptimizedAuthProvider({ children }: { children: ReactNode }) {
  return (
    <ContextErrorBoundary>
      <AuthProviderCore>
        <AuthSideEffectsProvider>
          {children}
        </AuthSideEffectsProvider>
      </AuthProviderCore>
    </ContextErrorBoundary>
  );
}

// Side effects provider (separate from state management)
function AuthSideEffectsProvider({ children }: { children: ReactNode }) {
  const dispatch = useContextDispatch();
  const [persistedAuth, setPersistedAuth] = useLocalStorage('auth', {
    token: null,
    refreshToken: null,
    user: null,
  });

  const user = useContextSelector(state => state.user);
  const token = useContextSelector(state => state.token);
  const refreshToken = useContextSelector(state => state.refreshToken);
  const isAuthenticated = useContextSelector(state => state.isAuthenticated);
  const sessionExpiry = useContextSelector(state => state.sessionExpiry);

  // Initialize auth state from localStorage
  useEffect(() => {
    if (persistedAuth.token && persistedAuth.user) {
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: persistedAuth.user,
          token: persistedAuth.token,
          refreshToken: persistedAuth.refreshToken,
        },
      });
    }
  }, [persistedAuth, dispatch]);

  // Persist auth state changes
  useEffect(() => {
    if (isAuthenticated && user && token) {
      setPersistedAuth({
        token,
        refreshToken,
        user,
      });
    } else {
      setPersistedAuth({
        token: null,
        refreshToken: null,
        user: null,
      });
    }
  }, [isAuthenticated, user, token, refreshToken, setPersistedAuth]);

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (sessionExpiry && refreshToken) {
      const timeUntilExpiry = sessionExpiry.getTime() - Date.now();
      const refreshTime = timeUntilExpiry - 5 * 60 * 1000; // Refresh 5 minutes before expiry

      if (refreshTime > 0) {
        const timeout = setTimeout(async () => {
          try {
            const result = await mockRefreshToken(refreshToken);
            dispatch({ type: 'REFRESH_TOKEN_SUCCESS', payload: result });
          } catch (error) {
            dispatch({ type: 'LOGOUT' });
          }
        }, refreshTime);

        return () => clearTimeout(timeout);
      }
    }
  }, [sessionExpiry, refreshToken, dispatch]);

  return <>{children}</>;
}

// Optimized hooks with selectors
export function useAuthUser() {
  return useContextSelector(state => state.user);
}

export function useAuthToken() {
  return useContextSelector(state => state.token);
}

export function useAuthLoading() {
  return useContextSelector(state => state.isLoading);
}

export function useAuthError() {
  return useContextSelector(state => state.error);
}

export function useAuthStatus() {
  return useContextSelector(state => ({
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
  }));
}

// Actions hook
export function useAuthActions() {
  const dispatch = useContextDispatch();
  
  return React.useMemo(() => ({
    login: async (email: string, password: string) => {
      dispatch({ type: 'LOGIN_START' });
      try {
        const result = await mockLogin(email, password);
        dispatch({ type: 'LOGIN_SUCCESS', payload: result });
      } catch (error) {
        dispatch({ 
          type: 'LOGIN_FAILURE', 
          payload: error instanceof Error ? error.message : 'Login failed' 
        });
      }
    },
    logout: () => {
      dispatch({ type: 'LOGOUT' });
    },
    updateUser: (userData: Partial<User>) => {
      dispatch({ type: 'SET_USER', payload: userData });
    },
    clearError: () => {
      dispatch({ type: 'CLEAR_ERROR' });
    },
  }), [dispatch]);
}

// Combined hook for backward compatibility (with performance warning)
export function useOptimizedAuth() {
  const user = useAuthUser();
  const token = useAuthToken();
  const isLoading = useAuthLoading();
  const error = useAuthError();
  const isAuthenticated = useContextSelector(state => state.isAuthenticated);
  const actions = useAuthActions();

  return useMemoizedContextValue({
    user,
    token,
    isLoading,
    error,
    isAuthenticated,
    ...actions,
  }, [user, token, isLoading, error, isAuthenticated, actions]);
}

// Mock API functions (replace with actual API calls)
const mockLogin = async (email: string, password: string): Promise<{ user: User; token: string; refreshToken: string }> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (email === 'test@example.com' && password === 'password') {
    return {
      user: {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        preferences: {
          learningGoals: ['JavaScript', 'React'],
          preferredTopics: ['Web Development'],
          difficultyLevel: 'intermediate',
          studySchedule: {
            dailyGoal: 60,
            preferredTimes: ['morning'],
            daysPerWeek: 5,
          },
          notifications: {
            email: true,
            push: true,
            reminders: true,
          },
        },
        learningProfile: {
          id: '1',
          userId: '1',
          styles: [],
          dominantStyle: 'visual' as any,
          isMultimodal: false,
          assessmentHistory: [],
          behavioralIndicators: [],
          adaptationLevel: 50,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      token: 'mock-jwt-token',
      refreshToken: 'mock-refresh-token',
    };
  }
  
  throw new Error('Invalid credentials');
};

const mockRefreshToken = async (refreshToken: string): Promise<{ token: string; refreshToken: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    token: 'new-mock-jwt-token',
    refreshToken: 'new-mock-refresh-token',
  };
};

// Legacy compatibility
export const AuthProvider = OptimizedAuthProvider;
export const useAuth = useOptimizedAuth;