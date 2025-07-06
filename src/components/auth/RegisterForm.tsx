'use client';

import React, { useState } from 'react';
import { cn } from '@/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Eye, EyeOff, Mail, Lock, User, UserPlus } from 'lucide-react';

export interface RegisterFormProps extends React.HTMLAttributes<HTMLDivElement> {
  onSubmit?: (data: { name: string; email: string; password: string }) => void;
  onSignIn?: () => void;
  isLoading?: boolean;
  error?: string;
}

const RegisterForm = React.forwardRef<HTMLDivElement, RegisterFormProps>(
  ({ className, onSubmit, onSignIn, isLoading, error, ...props }, ref) => {
    const [formData, setFormData] = useState({
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateEmail = (email: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    const validatePassword = (password: string) => {
      const hasMinLength = password.length >= 8;
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      
      return { hasMinLength, hasUpperCase, hasLowerCase, hasNumbers };
    };

    const handleInputChange = (field: string, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }));
      }
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const newErrors: Record<string, string> = {};

      // Validate name
      if (!formData.name.trim()) {
        newErrors.name = 'Name is required';
      } else if (formData.name.trim().length < 2) {
        newErrors.name = 'Name must be at least 2 characters';
      }

      // Validate email
      if (!formData.email) {
        newErrors.email = 'Email is required';
      } else if (!validateEmail(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }

      // Validate password
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else {
        const passwordValidation = validatePassword(formData.password);
        if (!passwordValidation.hasMinLength) {
          newErrors.password = 'Password must be at least 8 characters';
        } else if (!passwordValidation.hasUpperCase || !passwordValidation.hasLowerCase || !passwordValidation.hasNumbers) {
          newErrors.password = 'Password must contain uppercase, lowercase, and numbers';
        }
      }

      // Validate confirm password
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }

      setErrors(newErrors);

      if (Object.keys(newErrors).length === 0) {
        onSubmit?.({
          name: formData.name.trim(),
          email: formData.email,
          password: formData.password
        });
      }
    };

    const passwordStrength = validatePassword(formData.password);

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
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                  {error}
                </div>
              )}
              
              <Input
                type="text"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                error={errors.name}
                startIcon={<User className="h-4 w-4" />}
                disabled={isLoading}
                autoComplete="name"
                required
              />

              <Input
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                error={errors.email}
                startIcon={<Mail className="h-4 w-4" />}
                disabled={isLoading}
                autoComplete="email"
                required
              />

              <div className="space-y-2">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  error={errors.password}
                  startIcon={<Lock className="h-4 w-4" />}
                  endIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  disabled={isLoading}
                  autoComplete="new-password"
                  required
                />
                
                {formData.password && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Password strength:</div>
                    <div className="flex space-x-1">
                      <div className={`h-1 w-1/4 rounded ${passwordStrength.hasMinLength ? 'bg-learning-secondary' : 'bg-muted'}`} />
                      <div className={`h-1 w-1/4 rounded ${passwordStrength.hasUpperCase ? 'bg-learning-secondary' : 'bg-muted'}`} />
                      <div className={`h-1 w-1/4 rounded ${passwordStrength.hasLowerCase ? 'bg-learning-secondary' : 'bg-muted'}`} />
                      <div className={`h-1 w-1/4 rounded ${passwordStrength.hasNumbers ? 'bg-learning-secondary' : 'bg-muted'}`} />
                    </div>
                  </div>
                )}
              </div>

              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                error={errors.confirmPassword}
                startIcon={<Lock className="h-4 w-4" />}
                endIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                disabled={isLoading}
                autoComplete="new-password"
                required
              />

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="rounded border-input bg-background"
                  disabled={isLoading}
                  required
                />
                <span className="text-sm text-muted-foreground">
                  I agree to the{' '}
                  <a href="#" className="text-learning-primary hover:underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-learning-primary hover:underline">
                    Privacy Policy
                  </a>
                </span>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
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
                  className="text-learning-primary hover:underline font-medium"
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