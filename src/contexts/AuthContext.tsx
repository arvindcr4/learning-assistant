'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { AuthState, AuthAction, User } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';

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

// Reducer function
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
        sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
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
        sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
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

// Context type
interface AuthContextType {
  state: AuthState;
  dispatch: React.Dispatch<AuthAction>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock API functions (replace with actual API calls)
const mockLogin = async (email: string, password: string): Promise<{ user: User; token: string; refreshToken: string }> => {
  // Simulate API call
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
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    token: 'new-mock-jwt-token',
    refreshToken: 'new-mock-refresh-token',
  };
};

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const [persistedAuth, setPersistedAuth] = useLocalStorage('auth', {
    token: null,
    refreshToken: null,
    user: null,
  });

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
  }, [persistedAuth]);

  // Persist auth state changes
  useEffect(() => {
    if (state.isAuthenticated && state.user && state.token) {
      setPersistedAuth({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
      });
    } else {
      setPersistedAuth({
        token: null,
        refreshToken: null,
        user: null,
      });
    }
  }, [state.isAuthenticated, state.user, state.token, state.refreshToken, setPersistedAuth]);

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (state.sessionExpiry && state.refreshToken) {
      const timeUntilExpiry = state.sessionExpiry.getTime() - Date.now();
      const refreshTime = timeUntilExpiry - 5 * 60 * 1000; // Refresh 5 minutes before expiry

      if (refreshTime > 0) {
        const timeout = setTimeout(() => {
          refreshToken();
        }, refreshTime);

        return () => clearTimeout(timeout);
      }
    }
  }, [state.sessionExpiry, state.refreshToken]);

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const result = await mockLogin(email, password);
      dispatch({ type: 'LOGIN_SUCCESS', payload: result });
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE', payload: error instanceof Error ? error.message : 'Login failed' });
    }
  }, []);

  const logout = useCallback(() => {
    dispatch({ type: 'LOGOUT' });
  }, []);

  const refreshToken = useCallback(async () => {
    if (!state.refreshToken) return;

    try {
      const result = await mockRefreshToken(state.refreshToken);
      dispatch({ type: 'REFRESH_TOKEN_SUCCESS', payload: result });
    } catch (error) {
      // If refresh fails, logout the user
      dispatch({ type: 'LOGOUT' });
    }
  }, [state.refreshToken]);

  const updateUser = useCallback((userData: Partial<User>) => {
    if (state.user) {
      dispatch({ type: 'SET_USER', payload: { ...state.user, ...userData } });
    }
  }, [state.user]);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value: AuthContextType = {
    state,
    dispatch,
    login,
    logout,
    refreshToken,
    updateUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}