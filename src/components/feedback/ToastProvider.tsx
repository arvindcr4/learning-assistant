'use client';

import React from 'react';
import { createContext, useContext, useState, useCallback } from 'react';

import { Toast, ToastProps } from '@/components/ui/Toast';
import { cn } from '@/utils';

interface ToastContextType {
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

interface ToastData extends Omit<ToastProps, 'onClose'> {
  id: string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export function ToastProvider({ 
  children, 
  maxToasts = 5, 
  position = 'top-right' 
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 15);
    const newToast: ToastData = { ...toast, id };
    
    setToasts(prev => {
      const updated = [newToast, ...prev];
      return updated.slice(0, maxToasts);
    });
  }, [maxToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast, clearToasts }}>
      {children}
      
      {/* Toast Container */}
      <div 
        className={cn(
          "fixed z-50 flex flex-col space-y-2 pointer-events-none",
          getPositionClasses()
        )}
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              {...toast}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Helper hook for common toast types
export function useToastHelpers() {
  const { addToast } = useToast();

  return {
    success: (title: string, description?: string) => 
      addToast({ title, description, variant: 'success' }),
    
    error: (title: string, description?: string) => 
      addToast({ title, description, variant: 'error' }),
    
    warning: (title: string, description?: string) => 
      addToast({ title, description, variant: 'warning' }),
    
    info: (title: string, description?: string) => 
      addToast({ title, description, variant: 'info' }),
    
    custom: (toast: Omit<ToastData, 'id'>) => addToast(toast),
  };
}