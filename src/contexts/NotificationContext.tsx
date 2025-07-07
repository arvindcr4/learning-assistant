'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';

import type { NotificationState, NotificationAction, Notification as AppNotification, Alert, NotificationSettings } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { 
  sendWelcomeEmail, 
  sendProgressUpdateEmail, 
  sendStudyReminderEmail, 
  sendSystemAlertEmail 
} from '@/lib/email';

// Initial state
const initialState: NotificationState = {
  notifications: [],
  alerts: [],
  unreadCount: 0,
  settings: {
    email: true,
    push: true,
    inApp: true,
    studyReminders: true,
    goalReminders: true,
    progressUpdates: true,
    systemAlerts: true,
  },
};

// Reducer function
function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      };

    case 'MARK_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload
            ? { ...notification, read: true }
            : notification
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };

    case 'REMOVE_NOTIFICATION':
      const removedNotification = state.notifications.find(n => n.id === action.payload);
      return {
        ...state,
        notifications: state.notifications.filter(notification => notification.id !== action.payload),
        unreadCount: removedNotification && !removedNotification.read 
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      };

    case 'ADD_ALERT':
      return {
        ...state,
        alerts: [action.payload, ...state.alerts],
      };

    case 'REMOVE_ALERT':
      return {
        ...state,
        alerts: state.alerts.filter(alert => alert.id !== action.payload),
      };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };

    case 'CLEAR_ALL':
      return {
        ...state,
        notifications: [],
        alerts: [],
        unreadCount: 0,
      };

    default:
      return state;
  }
}

// Context type
interface NotificationContextType {
  state: NotificationState;
  dispatch: React.Dispatch<NotificationAction>;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  removeAlert: (id: string) => void;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  clearAll: () => void;
  requestPermission: () => Promise<boolean>;
  scheduleReminder: (message: string, delay: number) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
  sendWelcomeNotification: (userEmail: string, userName: string, activationLink?: string) => Promise<void>;
  sendProgressNotification: (userEmail: string, userName: string, progressData: any) => Promise<void>;
  sendStudyReminder: (userEmail: string, userName: string, reminderData: any) => Promise<void>;
  sendSystemAlert: (userEmail: string, userName: string, alertData: any) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Provider component
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const [persistedNotifications, setPersistedNotifications] = useLocalStorage('notifications', {
    settings: initialState.settings,
  });

  // Initialize notification settings from localStorage
  useEffect(() => {
    if (persistedNotifications.settings) {
      dispatch({ type: 'UPDATE_SETTINGS', payload: persistedNotifications.settings });
    }
  }, [persistedNotifications.settings]);

  // Persist notification settings changes
  useEffect(() => {
    setPersistedNotifications({
      settings: state.settings,
    });
  }, [state.settings, setPersistedNotifications]);

  // Clean up expired notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      state.notifications.forEach(notification => {
        if (notification.expiresAt && notification.expiresAt < now) {
          dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id });
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [state.notifications]);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && state.settings.push) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [state.settings.push]);

  const addNotification = useCallback((notificationData: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    if (!state.settings.inApp) return;

    const notification: AppNotification = {
      ...notificationData,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
    };

    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });

    // Show browser notification if enabled and permission granted
    if (state.settings.push && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/icon-192x192.png', // Add your app icon
          tag: notification.id,
        });
      }
    }
  }, [state.settings.inApp, state.settings.push]);

  const addAlert = useCallback((alertData: Omit<Alert, 'id' | 'timestamp'>) => {
    if (!state.settings.systemAlerts && alertData.type === 'error') return;

    const alert: Alert = {
      ...alertData,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    dispatch({ type: 'ADD_ALERT', payload: alert });

    // Auto-remove non-persistent alerts after 5 seconds
    if (!alert.persistent) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_ALERT', payload: alert.id });
      }, 5000);
    }
  }, [state.settings.systemAlerts]);

  const markAsRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_AS_READ', payload: id });
  }, []);

  const markAllAsRead = useCallback(() => {
    state.notifications.forEach(notification => {
      if (!notification.read) {
        dispatch({ type: 'MARK_AS_READ', payload: notification.id });
      }
    });
  }, [state.notifications]);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const removeAlert = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ALERT', payload: id });
  }, []);

  const updateSettings = useCallback((settings: Partial<NotificationSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  const scheduleReminder = useCallback((message: string, delay: number) => {
    if (!state.settings.studyReminders) return;

    setTimeout(() => {
      addNotification({
        type: 'info',
        title: 'Study Reminder',
        message,
        actions: [
          { id: 'start', label: 'Start Learning', action: 'start_learning' },
          { id: 'later', label: 'Remind Later', action: 'snooze_reminder' },
        ],
      });
    }, delay);
  }, [state.settings.studyReminders, addNotification]);

  const showToast = useCallback((
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    duration: number = 3000
  ) => {
    const alert: Alert = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title: '',
      message,
      persistent: false,
      timestamp: new Date(),
    };

    dispatch({ type: 'ADD_ALERT', payload: alert });

    setTimeout(() => {
      dispatch({ type: 'REMOVE_ALERT', payload: alert.id });
    }, duration);
  }, []);

  const sendWelcomeNotification = useCallback(async (
    userEmail: string,
    userName: string,
    activationLink?: string
  ) => {
    if (!state.settings.email) return;

    try {
      const result = await sendWelcomeEmail(userEmail, userName, activationLink);
      if (result.success) {
        addNotification({
          type: 'success',
          title: 'Welcome Email Sent',
          message: `Welcome email sent to ${userEmail}`,
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Email Send Failed',
          message: `Failed to send welcome email: ${result.error}`,
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Email Service Error',
        message: 'Failed to send welcome email due to service error',
      });
    }
  }, [state.settings.email, addNotification]);

  const sendProgressNotification = useCallback(async (
    userEmail: string,
    userName: string,
    progressData: {
      completedModules: number;
      totalModules: number;
      currentStreak: number;
      timeSpent: number;
      achievements: string[];
      nextGoals: string[];
    }
  ) => {
    if (!state.settings.email || !state.settings.progressUpdates) return;

    try {
      const result = await sendProgressUpdateEmail(userEmail, userName, progressData);
      if (result.success) {
        addNotification({
          type: 'success',
          title: 'Progress Update Sent',
          message: `Progress update email sent to ${userEmail}`,
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Email Send Failed',
          message: `Failed to send progress update: ${result.error}`,
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Email Service Error',
        message: 'Failed to send progress update due to service error',
      });
    }
  }, [state.settings.email, state.settings.progressUpdates, addNotification]);

  const sendStudyReminder = useCallback(async (
    userEmail: string,
    userName: string,
    reminderData: {
      nextModule: string;
      suggestedDuration: number;
      streakAtRisk: boolean;
      motivationalMessage: string;
    }
  ) => {
    if (!state.settings.email || !state.settings.studyReminders) return;

    try {
      const result = await sendStudyReminderEmail(userEmail, userName, reminderData);
      if (result.success) {
        addNotification({
          type: 'success',
          title: 'Study Reminder Sent',
          message: `Study reminder sent to ${userEmail}`,
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Email Send Failed',
          message: `Failed to send study reminder: ${result.error}`,
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Email Service Error',
        message: 'Failed to send study reminder due to service error',
      });
    }
  }, [state.settings.email, state.settings.studyReminders, addNotification]);

  const sendSystemAlert = useCallback(async (
    userEmail: string,
    userName: string,
    alertData: {
      type: 'maintenance' | 'security' | 'feature' | 'issue';
      title: string;
      description: string;
      actionRequired: boolean;
      actionUrl?: string;
      actionText?: string;
    }
  ) => {
    if (!state.settings.email || !state.settings.systemAlerts) return;

    try {
      const result = await sendSystemAlertEmail(userEmail, userName, alertData);
      if (result.success) {
        addNotification({
          type: 'success',
          title: 'System Alert Sent',
          message: `System alert sent to ${userEmail}`,
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Email Send Failed',
          message: `Failed to send system alert: ${result.error}`,
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Email Service Error',
        message: 'Failed to send system alert due to service error',
      });
    }
  }, [state.settings.email, state.settings.systemAlerts, addNotification]);

  const value: NotificationContextType = {
    state,
    dispatch,
    addNotification,
    addAlert,
    markAsRead,
    markAllAsRead,
    removeNotification,
    removeAlert,
    updateSettings,
    clearAll,
    requestPermission,
    scheduleReminder,
    showToast,
    sendWelcomeNotification,
    sendProgressNotification,
    sendStudyReminder,
    sendSystemAlert,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

// Hook to use the notification context
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// Higher-order component for notification integration
export function withNotifications<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function NotificationWrappedComponent(props: P) {
    const notifications = useNotifications();
    
    return <Component {...props} notifications={notifications} />;
  };
}