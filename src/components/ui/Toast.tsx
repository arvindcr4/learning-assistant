'use client';

import React from 'react';
import { X } from 'lucide-react';

import { cn } from '@/utils';

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  onClose?: () => void;
  duration?: number;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, title, description, variant = 'default', onClose, duration = 5000, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(true);

    React.useEffect(() => {
      if (duration > 0) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => onClose?.(), 150);
        }, duration);

        return () => clearTimeout(timer);
      }
    }, [duration, onClose]);

    const variantClasses = {
      default: 'bg-background border-border',
      success: 'bg-learning-secondary text-white border-learning-secondary',
      warning: 'bg-learning-accent text-black border-learning-accent',
      error: 'bg-destructive text-destructive-foreground border-destructive',
      info: 'bg-learning-primary text-white border-learning-primary'
    };

    if (!isVisible) return null;

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full max-w-sm items-center space-x-4 rounded-lg border p-4 shadow-lg transition-all duration-300",
          "animate-slide-in",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        <div className="flex-1 space-y-1">
          {title && (
            <p className="text-sm font-semibold leading-none">
              {title}
            </p>
          )}
          {description && (
            <p className="text-sm opacity-90">
              {description}
            </p>
          )}
        </div>
        {onClose && (
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(() => onClose(), 150);
            }}
            className="absolute right-2 top-2 rounded-md p-1 hover:bg-background/20 focus:outline-none focus:ring-2 focus:ring-offset-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

Toast.displayName = 'Toast';

export { Toast };