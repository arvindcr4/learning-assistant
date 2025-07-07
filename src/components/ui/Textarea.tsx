'use client';

import React from 'react';

import { cn } from '@/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
  maxLength?: number;
  showCharCount?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helpText, maxLength, showCharCount, ...props }, ref) => {
    const id = props.id || `textarea-${Math.random().toString(36).substring(2, 9)}`;
    const [charCount, setCharCount] = React.useState(props.value?.toString().length || 0);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      props.onChange?.(e);
    };

    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}
        <textarea
          id={id}
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          ref={ref}
          maxLength={maxLength}
          onChange={handleChange}
          {...props}
        />
        <div className="flex justify-between items-center">
          <div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {helpText && !error && (
              <p className="text-sm text-muted-foreground">
                {helpText}
              </p>
            )}
          </div>
          {(showCharCount || maxLength) && (
            <p className="text-sm text-muted-foreground">
              {charCount}{maxLength && `/${maxLength}`}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };