import React from 'react';

import { cn } from '@/utils';

export interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'learning' | 'visual' | 'auditory' | 'reading' | 'kinesthetic';
}

const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
  ({ 
    className, 
    value = 0, 
    max = 100, 
    size = 120, 
    strokeWidth = 8, 
    label, 
    showPercentage = true, 
    variant = 'default',
    ...props 
  }, ref) => {
    const percentage = Math.round((value / max) * 100);
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (clampedPercentage / 100) * circumference;

    const variantColors = {
      default: 'hsl(var(--primary))',
      learning: 'hsl(var(--learning-primary))',
      visual: 'hsl(var(--visual-primary))',
      auditory: 'hsl(var(--auditory-primary))',
      reading: 'hsl(var(--reading-primary))',
      kinesthetic: 'hsl(var(--kinesthetic-primary))'
    };

    return (
      <div 
        className={cn("relative inline-flex items-center justify-center", className)} 
        ref={ref} 
        {...props}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--progress-bg))"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={variantColors[variant]}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showPercentage && (
            <span className="text-2xl font-bold text-foreground">
              {clampedPercentage}%
            </span>
          )}
          {label && (
            <span className="text-sm text-muted-foreground text-center">
              {label}
            </span>
          )}
        </div>
      </div>
    );
  }
);

CircularProgress.displayName = 'CircularProgress';

export { CircularProgress };