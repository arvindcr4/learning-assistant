import React from 'react';

import { cn } from '@/utils';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { generateAccessibilityId, validateAccessibility } from '@/utils/accessibility';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  isRequired?: boolean;
  showCharacterCount?: boolean;
  maxLength?: number;
  validationRules?: string[];
  onValidate?: (value: string) => string | null;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    type, 
    label, 
    error, 
    helpText, 
    startIcon, 
    endIcon, 
    isRequired,
    showCharacterCount,
    maxLength,
    validationRules,
    onValidate,
    onChange,
    onFocus,
    onBlur,
    ...props 
  }, ref) => {
    const { preferences, announceToScreenReader } = useAccessibility();
    const [value, setValue] = React.useState(props.value || '');
    const [isFocused, setIsFocused] = React.useState(false);
    const [validationError, setValidationError] = React.useState<string | null>(null);
    
    const id = props.id || generateAccessibilityId('input');
    const errorId = `${id}-error`;
    const helpId = `${id}-help`;
    const characterCountId = `${id}-char-count`;
    
    const currentError = error || validationError;

    const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setValue(newValue);
      
      // Validate on change
      if (onValidate) {
        const validationResult = onValidate(newValue);
        setValidationError(validationResult);
        
        if (validationResult) {
          announceToScreenReader(`Validation error: ${validationResult}`, 'assertive');
        }
      }
      
      if (onChange) {
        onChange(event);
      }
    }, [onValidate, onChange, announceToScreenReader]);

    const handleFocus = React.useCallback((event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      
      if (onFocus) {
        onFocus(event);
      }
      
      // Announce field information to screen reader
      if (helpText) {
        announceToScreenReader(`${label || 'Input field'}: ${helpText}`, 'polite');
      }
    }, [onFocus, helpText, label, announceToScreenReader]);

    const handleBlur = React.useCallback((event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      
      if (onBlur) {
        onBlur(event);
      }
    }, [onBlur]);

    const characterCount = typeof value === 'string' ? value.length : 0;
    const isOverLimit = maxLength && characterCount > maxLength;

    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={id}
            className={cn(
              "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
              preferences.largeText && "text-base",
              isRequired && "after:content-['*'] after:ml-1 after:text-red-500"
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {startIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
              {startIcon}
            </div>
          )}
          <input
            id={id}
            type={type}
            value={value}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              startIcon && "pl-10",
              endIcon && "pr-10",
              currentError && "border-destructive focus-visible:ring-destructive aria-invalid:border-destructive",
              preferences.largeText && "text-base h-12 px-4 py-3",
              preferences.focusIndicators && "focus-visible:ring-4 focus-visible:ring-offset-4",
              preferences.highContrast && "border-2 focus-visible:ring-4",
              isOverLimit && "border-red-500 focus-visible:ring-red-500",
              isFocused && "ring-2 ring-ring ring-offset-2",
              className
            )}
            ref={ref}
            required={isRequired}
            maxLength={maxLength}
            aria-invalid={!!currentError}
            aria-required={isRequired}
            aria-describedby={cn(
              helpText && helpId,
              currentError && errorId,
              showCharacterCount && characterCountId
            )}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />
          {endIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
              {endIcon}
            </div>
          )}
        </div>
        
        {/* Character count */}
        {showCharacterCount && maxLength && (
          <div
            id={characterCountId}
            className={cn(
              "text-xs text-muted-foreground text-right",
              isOverLimit && "text-red-500"
            )}
            aria-live="polite"
          >
            {characterCount} / {maxLength}
          </div>
        )}
        
        {/* Error message */}
        {currentError && (
          <p 
            id={errorId}
            className={cn(
              "text-sm text-destructive",
              preferences.largeText && "text-base"
            )}
            role="alert"
            aria-live="assertive"
          >
            {currentError}
          </p>
        )}
        
        {/* Help text */}
        {helpText && !currentError && (
          <p 
            id={helpId}
            className={cn(
              "text-sm text-muted-foreground",
              preferences.largeText && "text-base"
            )}
          >
            {helpText}
          </p>
        )}
        
        {/* Validation rules */}
        {validationRules && validationRules.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Requirements:</p>
            <ul className="list-disc list-inside space-y-1">
              {validationRules.map((rule, index) => (
                <li key={index}>{rule}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };