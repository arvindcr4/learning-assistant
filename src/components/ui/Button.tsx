import React from 'react';

import { cn } from '@/utils';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { generateAccessibilityId, handleKeyboardNavigation } from '@/utils/accessibility';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children: React.ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  tooltip?: string;
  iconOnly?: boolean;
  onPress?: () => void;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'default', 
    size = 'default', 
    children, 
    isLoading, 
    loadingText, 
    disabled, 
    ariaLabel,
    ariaDescribedBy,
    tooltip,
    iconOnly,
    onPress,
    onClick,
    onKeyDown,
    ...props 
  }, ref) => {
    const { preferences, announceToScreenReader } = useAccessibility();
    const [tooltipId] = React.useState(() => generateAccessibilityId('tooltip'));
    
    const baseStyles = cn(
      'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      preferences.reduceMotion && 'transition-none',
      preferences.focusIndicators && 'focus-visible:ring-4 focus-visible:ring-offset-4',
      preferences.largeText && 'text-lg px-6 py-3'
    );
    
    const variants = {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      link: 'text-primary underline-offset-4 hover:underline',
    };

    const sizes = {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 rounded-md px-3',
      lg: 'h-11 rounded-md px-8',
      icon: 'h-10 w-10',
    };

    const isDisabled = disabled || isLoading;

    const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) return;
      
      if (onPress) {
        onPress();
      }
      
      if (onClick) {
        onClick(event);
      }
      
      // Announce action to screen reader
      if (variant === 'destructive') {
        announceToScreenReader('Destructive action performed', 'assertive');
      } else if (isLoading) {
        announceToScreenReader('Loading started', 'polite');
      }
    }, [isDisabled, onPress, onClick, variant, isLoading, announceToScreenReader]);

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (isDisabled) return;
      
      handleKeyboardNavigation(event.nativeEvent, {
        onEnter: () => handleClick(event as any),
        onSpace: () => handleClick(event as any),
        preventDefault: true
      });
      
      if (onKeyDown) {
        onKeyDown(event);
      }
    }, [isDisabled, handleClick, onKeyDown]);

    return (
      <>
        <button
          className={cn(baseStyles, variants[variant], sizes[size], className)}
          ref={ref}
          disabled={isDisabled}
          aria-disabled={isDisabled}
          aria-busy={isLoading}
          aria-label={ariaLabel || (iconOnly ? 'Button' : undefined)}
          aria-describedby={ariaDescribedBy || (tooltip ? tooltipId : undefined)}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          {...props}
        >
          {isLoading ? (
            <>
              <svg 
                className={cn(
                  "-ml-1 mr-2 h-4 w-4",
                  !preferences.reduceMotion && "animate-spin"
                )}
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
                aria-hidden="true"
                role="img"
                aria-label="Loading indicator"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="sr-only">Loading...</span>
              {loadingText || children}
            </>
          ) : (
            children
          )}
        </button>
        
        {tooltip && (
          <div
            id={tooltipId}
            role="tooltip"
            className="absolute z-50 invisible opacity-0 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg transition-opacity duration-300 pointer-events-none"
            style={{ top: '-100%', left: '50%', transform: 'translateX(-50%)' }}
          >
            {tooltip}
          </div>
        )}
      </>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export type { ButtonProps };