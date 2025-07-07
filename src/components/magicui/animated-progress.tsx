"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils';
import { progressGrow, getAnimationDuration, prefersReducedMotion } from '@/lib/animation-config';

interface AnimatedProgressProps {
  value: number; // 0 to 100
  max?: number;
  className?: string;
  showLabel?: boolean;
  label?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  striped?: boolean;
  children?: React.ReactNode;
}

const colorVariants = {
  primary: 'bg-learning-primary',
  secondary: 'bg-learning-secondary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
};

const sizeVariants = {
  sm: 'h-2',
  md: 'h-4',
  lg: 'h-6',
};

export default function AnimatedProgress({
  value,
  max = 100,
  className,
  showLabel = false,
  label,
  color = 'primary',
  size = 'md',
  animated = true,
  striped = false,
  children,
}: AnimatedProgressProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const percentage = Math.min((value / max) * 100, 100);
  const shouldAnimate = animated && !prefersReducedMotion();

  useEffect(() => {
    // Animate the progress value
    if (shouldAnimate) {
      const timer = setTimeout(() => {
        setIsVisible(true);
        let start = 0;
        const increment = percentage / 30; // 30 frames for smooth animation
        
        const animate = () => {
          start += increment;
          if (start < percentage) {
            setDisplayValue(start);
            requestAnimationFrame(animate);
          } else {
            setDisplayValue(percentage);
          }
        };
        
        requestAnimationFrame(animate);
      }, 100);

      return () => clearTimeout(timer);
    } else {
      setDisplayValue(percentage);
      setIsVisible(true);
    }
  }, [percentage, shouldAnimate]);

  return (
    <div className={cn('w-full space-y-2', className)}>
      {(showLabel || label || children) && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-700 dark:text-gray-300">
            {label || children}
          </span>
          {showLabel && (
            <motion.span 
              className="text-gray-600 dark:text-gray-400 font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: isVisible ? 1 : 0 }}
              transition={{ duration: getAnimationDuration('normal') }}
            >
              {Math.round(displayValue)}%
            </motion.span>
          )}
        </div>
      )}
      
      <div className={cn(
        'w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
        sizeVariants[size]
      )}>
        <motion.div
          className={cn(
            'h-full rounded-full transition-colors duration-300',
            colorVariants[color],
            {
              'bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:50px_100%] animate-pulse': striped,
            }
          )}
          initial={shouldAnimate ? { width: 0 } : { width: `${percentage}%` }}
          animate={{ width: `${displayValue}%` }}
          transition={shouldAnimate ? {
            duration: getAnimationDuration('slow'),
            ease: 'easeOut',
          } : { duration: 0 }}
          style={{
            backgroundImage: striped 
              ? 'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent)'
              : undefined,
            backgroundSize: striped ? '1rem 1rem' : undefined,
          }}
        />
      </div>
    </div>
  );
}

// Circular progress variant
interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  children?: React.ReactNode;
}

export function AnimatedCircularProgress({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  className,
  color = 'primary',
  showLabel = false,
  children,
}: CircularProgressProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const percentage = Math.min((value / max) * 100, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const shouldAnimate = !prefersReducedMotion();

  useEffect(() => {
    if (shouldAnimate) {
      let start = 0;
      const increment = percentage / 60; // 60 frames for smooth animation
      
      const animate = () => {
        start += increment;
        if (start < percentage) {
          setDisplayValue(start);
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(percentage);
        }
      };
      
      const timer = setTimeout(() => {
        requestAnimationFrame(animate);
      }, 100);

      return () => clearTimeout(timer);
    } else {
      setDisplayValue(percentage);
    }
  }, [percentage, shouldAnimate]);

  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (displayValue / 100) * circumference;

  const colorClasses = {
    primary: 'text-learning-primary',
    secondary: 'text-learning-secondary',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className={colorClasses[color]}
          initial={shouldAnimate ? { strokeDashoffset: circumference } : { strokeDashoffset }}
          animate={{ strokeDashoffset }}
          transition={shouldAnimate ? {
            duration: getAnimationDuration('slow'),
            ease: 'easeOut',
          } : { duration: 0 }}
          style={{
            strokeDasharray,
          }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {showLabel ? (
          <motion.span 
            className="text-2xl font-bold text-gray-900 dark:text-gray-100"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ 
              duration: getAnimationDuration('normal'),
              delay: shouldAnimate ? getAnimationDuration('slow') / 2 : 0,
            }}
          >
            {Math.round(displayValue)}%
          </motion.span>
        ) : children}
      </div>
    </div>
  );
}

// Multi-step progress component
interface StepProgressProps {
  steps: Array<{
    label: string;
    completed: boolean;
    current?: boolean;
  }>;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export function AnimatedStepProgress({
  steps,
  className,
  orientation = 'horizontal',
}: StepProgressProps) {
  const [visibleSteps, setVisibleSteps] = useState(0);
  const shouldAnimate = !prefersReducedMotion();

  useEffect(() => {
    if (shouldAnimate) {
      steps.forEach((_, index) => {
        setTimeout(() => {
          setVisibleSteps(index + 1);
        }, index * 200);
      });
    } else {
      setVisibleSteps(steps.length);
    }
  }, [steps, shouldAnimate]);

  const isHorizontal = orientation === 'horizontal';

  return (
    <div className={cn(
      'flex items-center',
      isHorizontal ? 'space-x-4' : 'flex-col space-y-4',
      className
    )}>
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <motion.div
            className="flex items-center"
            initial={shouldAnimate ? { opacity: 0, scale: 0.8 } : {}}
            animate={index < visibleSteps ? { opacity: 1, scale: 1 } : {}}
            transition={{
              duration: getAnimationDuration('normal'),
              delay: shouldAnimate ? index * 0.1 : 0,
            }}
          >
            <div className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors duration-300',
              step.completed
                ? 'bg-learning-primary border-learning-primary text-white'
                : step.current
                ? 'border-learning-primary text-learning-primary bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400'
            )}>
              {step.completed ? (
                <motion.svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    duration: getAnimationDuration('normal'),
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </motion.svg>
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>
            
            <span className={cn(
              'ml-2 text-sm font-medium transition-colors duration-300',
              step.completed
                ? 'text-learning-primary'
                : step.current
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400'
            )}>
              {step.label}
            </span>
          </motion.div>
          
          {index < steps.length - 1 && (
            <motion.div
              className={cn(
                'flex-1 h-0.5 bg-gray-200 dark:bg-gray-700',
                isHorizontal ? 'w-full' : 'h-4 w-0.5 ml-4'
              )}
              initial={shouldAnimate ? { scaleX: isHorizontal ? 0 : 1, scaleY: isHorizontal ? 1 : 0 } : {}}
              animate={index < visibleSteps - 1 ? { 
                scaleX: 1, 
                scaleY: 1,
                backgroundColor: step.completed ? 'hsl(217 91% 60%)' : undefined
              } : {}}
              transition={{
                duration: getAnimationDuration('normal'),
                delay: shouldAnimate ? (index + 0.5) * 0.1 : 0,
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}