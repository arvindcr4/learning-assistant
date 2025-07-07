'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

import { cn } from '@/utils';

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        success: "border-learning-secondary/50 text-learning-secondary dark:border-learning-secondary [&>svg]:text-learning-secondary",
        warning: "border-learning-accent/50 text-learning-accent dark:border-learning-accent [&>svg]:text-learning-accent",
        info: "border-learning-primary/50 text-learning-primary dark:border-learning-primary [&>svg]:text-learning-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  description?: string;
  onClose?: () => void;
  dismissible?: boolean;
  icon?: React.ReactNode;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, title, description, onClose, dismissible = false, icon, children, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(true);

    const getDefaultIcon = () => {
      switch (variant) {
        case 'destructive':
          return <AlertCircle className="h-4 w-4" />;
        case 'success':
          return <CheckCircle className="h-4 w-4" />;
        case 'warning':
          return <AlertTriangle className="h-4 w-4" />;
        case 'info':
          return <Info className="h-4 w-4" />;
        default:
          return <Info className="h-4 w-4" />;
      }
    };

    const handleClose = () => {
      setIsVisible(false);
      setTimeout(() => onClose?.(), 150);
    };

    if (!isVisible) return null;

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), "transition-all duration-300", className)}
        {...props}
      >
        {icon || getDefaultIcon()}
        <div className="flex-1">
          {title && (
            <h5 className="mb-1 font-medium leading-none tracking-tight">
              {title}
            </h5>
          )}
          {description && (
            <div className="text-sm [&_p]:leading-relaxed">
              {description}
            </div>
          )}
          {children}
        </div>
        {dismissible && (
          <button
            onClick={handleClose}
            className="absolute right-2 top-2 rounded-md p-1 hover:bg-background/80 focus:outline-none focus:ring-2 focus:ring-offset-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export { Alert, alertVariants };