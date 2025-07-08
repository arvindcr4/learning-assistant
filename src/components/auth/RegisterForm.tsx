'use client';

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, User, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';

import { cn } from '@/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { userRegistrationSchema, type UserRegistration } from '@/lib/validation/schemas';

export interface RegisterFormProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSubmit'> {
  onSubmit?: (data: Omit<UserRegistration, 'confirmPassword' | 'termsAccepted'>) => void;
  onSignIn?: () => void;
  isLoading?: boolean;
  error?: string;
}

const RegisterForm = React.forwardRef<HTMLDivElement, RegisterFormProps>(
  ({ className, onSubmit, onSignIn, isLoading, error, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const {
      register,
      handleSubmit,
      formState: { errors, isValid, touchedFields },
      watch,
      clearErrors,
    } = useForm<UserRegistration>({
      resolver: zodResolver(userRegistrationSchema),
      mode: 'onChange',
      defaultValues: {
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        termsAccepted: false,
        marketing: false,
      },
    });

    const watchedPassword = watch('password');
    const watchedConfirmPassword = watch('confirmPassword');
    const watchedEmail = watch('email');
    const watchedName = watch('name');

    const onFormSubmit = useCallback((data: UserRegistration) => {
      // Clear any previous errors
      clearErrors();
      
      // Remove confirmPassword and termsAccepted from data before submitting
      const { confirmPassword, termsAccepted, marketing, ...submitData } = data;
      onSubmit?.(submitData);
    }, [clearErrors, onSubmit]);

    const getFieldError = (fieldName: keyof UserRegistration) => {
      return errors[fieldName]?.message;
    };

    const isFieldTouched = (fieldName: keyof UserRegistration) => {
      return touchedFields[fieldName];
    };

    const hasFieldError = (fieldName: keyof UserRegistration) => {
      return isFieldTouched(fieldName) && !!errors[fieldName];
    };

    const isFieldValid = (fieldName: keyof UserRegistration) => {
      return isFieldTouched(fieldName) && !errors[fieldName] && watch(fieldName);
    };

    // Password strength indicators
    const getPasswordStrength = (password: string) => {
      const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^a-zA-Z0-9]/.test(password),
      };
      
      const score = Object.values(checks).filter(Boolean).length;
      return { checks, score };
    };

    const passwordStrength = watchedPassword ? getPasswordStrength(watchedPassword) : null;

    return (
      <div ref={ref} className={cn("w-full max-w-md", className)} {...props}>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Create account</CardTitle>
            <CardDescription className="text-center">
              Join our learning community and start your personalized learning journey
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
                  {...register('name')}
                  type="text"
                  placeholder="Enter your full name"
                  error={getFieldError('name')}
                  startIcon={<User className="h-4 w-4" />}
                  endIcon={isFieldValid('name') ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : undefined}
                  disabled={isLoading}
                  autoComplete="name"
                  aria-invalid={hasFieldError('name')}
                  aria-describedby={hasFieldError('name') ? 'name-error' : undefined}
                  className={cn(
                    hasFieldError('name') && 'border-destructive focus:border-destructive',
                    isFieldValid('name') && 'border-green-500 focus:border-green-500'
                  )}
                />
                {hasFieldError('name') && (
                  <p id="name-error" className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('name')}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="Enter your email"
                  error={getFieldError('email')}
                  startIcon={<Mail className="h-4 w-4" />}
                  endIcon={isFieldValid('email') ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : undefined}
                  disabled={isLoading}
                  autoComplete="email"
                  aria-invalid={hasFieldError('email')}
                  aria-describedby={hasFieldError('email') ? 'email-error' : undefined}
                  className={cn(
                    hasFieldError('email') && 'border-destructive focus:border-destructive',
                    isFieldValid('email') && 'border-green-500 focus:border-green-500'
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
                  placeholder="Create a password"
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
                  autoComplete="new-password"
                  aria-invalid={hasFieldError('password')}
                  aria-describedby={hasFieldError('password') ? 'password-error' : 'password-strength'}
                  className={cn(
                    hasFieldError('password') && 'border-destructive focus:border-destructive',
                    isFieldValid('password') && 'border-green-500 focus:border-green-500'
                  )}
                />
                
                {hasFieldError('password') && (
                  <p id="password-error" className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('password')}
                  </p>
                )}

                {watchedPassword && !hasFieldError('password') && (
                  <div id="password-strength" className="space-y-2">
                    <div className="text-xs text-muted-foreground">Password strength:</div>
                    <div className="flex space-x-1">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div
                          key={index}
                          className={cn(
                            "h-1 w-full rounded",
                            passwordStrength && index < passwordStrength.score
                              ? passwordStrength.score <= 2
                                ? "bg-destructive"
                                : passwordStrength.score <= 3
                                ? "bg-learning-warning"
                                : "bg-learning-secondary"
                              : "bg-muted"
                          )}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {passwordStrength && Object.entries(passwordStrength.checks).map(([key, met]) => (
                        <div key={key} className={cn("flex items-center gap-1", met ? "text-learning-secondary" : "text-muted-foreground")}>
                          {met ? <CheckCircle2 className="h-3 w-3" /> : <div className="h-3 w-3 rounded-full border border-current" />}
                          <span>
                            {key === 'length' && '8+ chars'}
                            {key === 'uppercase' && 'Uppercase'}
                            {key === 'lowercase' && 'Lowercase'}
                            {key === 'number' && 'Number'}
                            {key === 'special' && 'Special'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Input
                  {...register('confirmPassword')}
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  error={getFieldError('confirmPassword')}
                  startIcon={<Lock className="h-4 w-4" />}
                  endIcon={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="hover:text-foreground transition-colors focus:outline-none"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  disabled={isLoading}
                  autoComplete="new-password"
                  aria-invalid={hasFieldError('confirmPassword')}
                  aria-describedby={hasFieldError('confirmPassword') ? 'confirm-password-error' : undefined}
                  className={cn(
                    hasFieldError('confirmPassword') && 'border-destructive focus:border-destructive',
                    isFieldValid('confirmPassword') && 'border-green-500 focus:border-green-500'
                  )}
                />
                {hasFieldError('confirmPassword') && (
                  <p id="confirm-password-error" className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('confirmPassword')}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <input
                    {...register('termsAccepted')}
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-input bg-background text-learning-primary focus:ring-2 focus:ring-learning-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoading}
                    aria-describedby={hasFieldError('termsAccepted') ? 'terms-error' : undefined}
                  />
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground leading-relaxed">
                      I agree to the{' '}
                      <a href="/terms" className="text-learning-primary hover:underline focus:outline-none focus:underline" target="_blank" rel="noopener noreferrer">
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a href="/privacy" className="text-learning-primary hover:underline focus:outline-none focus:underline" target="_blank" rel="noopener noreferrer">
                        Privacy Policy
                      </a>
                    </label>
                    {hasFieldError('termsAccepted') && (
                      <p id="terms-error" className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {getFieldError('termsAccepted')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    {...register('marketing')}
                    type="checkbox"
                    className="h-4 w-4 rounded border-input bg-background text-learning-primary focus:ring-2 focus:ring-learning-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoading}
                  />
                  <label className="text-sm text-muted-foreground">
                    I would like to receive learning tips and product updates via email
                  </label>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !isValid}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-b-transparent mr-2" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create account
                  </>
                )}
              </Button>
            </form>

            {onSignIn && (
              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <button
                  onClick={onSignIn}
                  className="text-learning-primary hover:underline font-medium focus:outline-none focus:underline"
                  disabled={isLoading}
                >
                  Sign in here
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
);

RegisterForm.displayName = 'RegisterForm';

export { RegisterForm };