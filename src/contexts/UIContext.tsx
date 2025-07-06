'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { UIState, UIAction, ModalState, ToastState } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';

// Initial state
const initialState: UIState = {
  theme: 'system',
  sidebarOpen: true,
  loading: false,
  modal: null,
  toast: null,
};

// Reducer function
function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_THEME':
      return {
        ...state,
        theme: action.payload,
      };

    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        sidebarOpen: !state.sidebarOpen,
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };

    case 'SHOW_MODAL':
      return {
        ...state,
        modal: action.payload,
      };

    case 'HIDE_MODAL':
      return {
        ...state,
        modal: null,
      };

    case 'SHOW_TOAST':
      return {
        ...state,
        toast: action.payload,
      };

    case 'HIDE_TOAST':
      return {
        ...state,
        toast: null,
      };

    default:
      return state;
  }
}

// Context type
interface UIContextType {
  state: UIState;
  dispatch: React.Dispatch<UIAction>;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
  showModal: (modal: ModalState) => void;
  hideModal: () => void;
  showToast: (toast: Omit<ToastState, 'id'>) => void;
  hideToast: () => void;
  showSuccessToast: (title: string, message?: string) => void;
  showErrorToast: (title: string, message?: string) => void;
  showWarningToast: (title: string, message?: string) => void;
  showInfoToast: (title: string, message?: string) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

// Provider component
export function UIProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(uiReducer, initialState);
  const [persistedUI, setPersistedUI] = useLocalStorage('ui', {
    theme: 'system',
    sidebarOpen: true,
  });

  // Initialize UI state from localStorage
  useEffect(() => {
    if (persistedUI.theme) {
      dispatch({ type: 'SET_THEME', payload: persistedUI.theme });
    }
    if (typeof persistedUI.sidebarOpen === 'boolean') {
      if (persistedUI.sidebarOpen !== state.sidebarOpen) {
        dispatch({ type: 'TOGGLE_SIDEBAR' });
      }
    }
  }, [persistedUI, state.sidebarOpen]);

  // Persist UI state changes
  useEffect(() => {
    setPersistedUI({
      theme: state.theme,
      sidebarOpen: state.sidebarOpen,
    });
  }, [state.theme, state.sidebarOpen, setPersistedUI]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    if (state.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', state.theme === 'dark');
    }
  }, [state.theme]);

  // Auto-hide toast after duration
  useEffect(() => {
    if (state.toast && state.toast.duration) {
      const timeout = setTimeout(() => {
        dispatch({ type: 'HIDE_TOAST' });
      }, state.toast.duration);

      return () => clearTimeout(timeout);
    }
  }, [state.toast]);

  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);

  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const showModal = useCallback((modal: ModalState) => {
    dispatch({ type: 'SHOW_MODAL', payload: modal });
  }, []);

  const hideModal = useCallback(() => {
    dispatch({ type: 'HIDE_MODAL' });
  }, []);

  const showToast = useCallback((toastData: Omit<ToastState, 'id'>) => {
    const toast: ToastState = {
      ...toastData,
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      duration: toastData.duration || 3000,
    };
    dispatch({ type: 'SHOW_TOAST', payload: toast });
  }, []);

  const hideToast = useCallback(() => {
    dispatch({ type: 'HIDE_TOAST' });
  }, []);

  const showSuccessToast = useCallback((title: string, message?: string) => {
    showToast({
      type: 'success',
      title,
      message,
      duration: 3000,
    });
  }, [showToast]);

  const showErrorToast = useCallback((title: string, message?: string) => {
    showToast({
      type: 'error',
      title,
      message,
      duration: 5000,
    });
  }, [showToast]);

  const showWarningToast = useCallback((title: string, message?: string) => {
    showToast({
      type: 'warning',
      title,
      message,
      duration: 4000,
    });
  }, [showToast]);

  const showInfoToast = useCallback((title: string, message?: string) => {
    showToast({
      type: 'info',
      title,
      message,
      duration: 3000,
    });
  }, [showToast]);

  const value: UIContextType = {
    state,
    dispatch,
    setTheme,
    toggleSidebar,
    setLoading,
    showModal,
    hideModal,
    showToast,
    hideToast,
    showSuccessToast,
    showErrorToast,
    showWarningToast,
    showInfoToast,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

// Hook to use the UI context
export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}

// Higher-order component for UI integration
export function withUI<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function UIWrappedComponent(props: P) {
    const ui = useUI();
    
    return <Component {...props} ui={ui} />;
  };
}