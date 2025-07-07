'use client';

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, LogIn, AlertCircle } from 'lucide-react';

import { cn } from '@/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { userLoginSchema, type UserLogin } from '@/lib/validation/schemas';

export interface LoginFormProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSubmit'> {
  onSubmit?: (email: string, password: string) => void;
  onForgotPassword?: () => void;
  onSignUp?: () => void;
  isLoading?: boolean;
  error?: string;
}

const LoginForm = React.forwardRef<HTMLDivElement, LoginFormProps>(
  ({ className, onSubmit, onForgotPassword, onSignUp, isLoading, error, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const {
      register,
      handleSubmit,
      formState: { errors, isValid, touchedFields },
      watch,
      clearErrors,
    } = useForm<UserLogin>({
      resolver: zodResolver(userLoginSchema),
      mode: 'onChange',
      defaultValues: {
        email: '',
        password: '',
        rememberMe: false,
      },
    });

    const watchedEmail = watch('email');
    const watchedPassword = watch('password');

    const onFormSubmit = useCallback((data: UserLogin) => {
      // Clear any previous errors
      clearErrors();
      onSubmit?.(data.email, data.password);
    }, [clearErrors, onSubmit]);

    const getFieldError = (fieldName: keyof UserLogin) => {
      return errors[fieldName]?.message;
    };

    const isFieldTouched = (fieldName: keyof UserLogin) => {
      return touchedFields[fieldName];
    };

    const hasFieldError = (fieldName: keyof UserLogin) => {
      return isFieldTouched(fieldName) && !!errors[fieldName];
    };

    return (
      <div ref={ref} className={cn("w-full max-w-md", className)} {...props}>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
            <CardDescription className="text-center">
              Enter your email and password to access your learning dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4" noValidate>
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              
              <div className="space-y-2">
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="Enter your email"
                  error={getFieldError('email')}
                  startIcon={<Mail className="h-4 w-4" />}
                  disabled={isLoading}
                  autoComplete="email"
                  aria-invalid={hasFieldError('email')}
                  aria-describedby={hasFieldError('email') ? 'email-error' : undefined}
                  className={cn(
                    hasFieldError('email') && 'border-destructive focus:border-destructive',
                    isFieldTouched('email') && !errors.email && watchedEmail && 'border-green-500 focus:border-green-500'
                  )}
                />
                {hasFieldError('email') && (
                  <p id="email-error" className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('email')}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Input
                  {...register('password')}
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  error={getFieldError('password')}
                  startIcon={<Lock className="h-4 w-4" />}
                  endIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="hover:text-foreground transition-colors focus:outline-none"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  disabled={isLoading}
                  autoComplete="current-password"
                  aria-invalid={hasFieldError('password')}
                  aria-describedby={hasFieldError('password') ? 'password-error' : undefined}
                  className={cn(
                    hasFieldError('password') && 'border-destructive focus:border-destructive',
                    isFieldTouched('password') && !errors.password && watchedPassword && 'border-green-500 focus:border-green-500'
                  )}
                />
                {hasFieldError('password') && (
                  <p id="password-error" className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('password')}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    {...register('rememberMe')}
                    type="checkbox"
                    className="rounded border-input bg-background focus:ring-2 focus:ring-learning-primary focus:ring-offset-2"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-muted-foreground">Remember me</span>
                </label>
                
                {onForgotPassword && (
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-sm text-learning-primary hover:underline focus:outline-none focus:underline"
                    disabled={isLoading}
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !isValid}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-b-transparent mr-2" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign in
                  </>
                )}
              </Button>
            </form>

            {onSignUp && (
              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">Don't have an account? </span>
                <button
                  onClick={onSignUp}
                  className="text-learning-primary hover:underline font-medium focus:outline-none focus:underline"
                  disabled={isLoading}
                >
                  Sign up here
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
);

LoginForm.displayName = 'LoginForm';

export { LoginForm };