import React from 'react';
import { cn } from '@/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'learning' | 'visual' | 'auditory' | 'reading' | 'kinesthetic';
  size?: 'sm' | 'md' | 'lg';
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, label, showPercentage = true, variant = 'default', size = 'md', ...props }, ref) => {
    const percentage = Math.round((value / max) * 100);
    const clampedPercentage = Math.max(0, Math.min(100, percentage));

    const sizeClasses = {
      sm: 'h-2',
      md: 'h-3',
      lg: 'h-4'
    };

    const variantClasses = {
      default: 'bg-primary',
      learning: 'bg-learning-primary',
      visual: 'bg-visual',
      auditory: 'bg-auditory',
      reading: 'bg-reading',
      kinesthetic: 'bg-kinesthetic'
    };

    return (
      <div className={cn("space-y-2", className)} ref={ref} {...props}>
        {(label || showPercentage) && (
          <div className="flex justify-between items-center">
            {label && (
              <label className="text-sm font-medium text-foreground">
                {label}
              </label>
            )}
            {showPercentage && (
              <span className="text-sm text-muted-foreground">
                {clampedPercentage}%
              </span>
            )}
          </div>
        )}
        <div 
          className={cn(
            "w-full bg-progress-bg rounded-full overflow-hidden",
            sizeClasses[size]
          )}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
        >
          <div
            className={cn(
              "h-full transition-all duration-500 ease-out rounded-full",
              variantClasses[variant]
            )}
            style={{ width: `${clampedPercentage}%` }}
          />
        </div>
      </div>
    );
  }
);

Progress.displayName = 'Progress';

export { Progress };