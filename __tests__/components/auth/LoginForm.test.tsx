import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/auth/LoginForm';
import { user } from '../../utils/test-utils';

// Mock the icons
jest.mock('lucide-react', () => ({
  Eye: ({ className }: { className?: string }) => <span className={className} data-testid="eye-icon">👁</span>,
  EyeOff: ({ className }: { className?: string }) => <span className={className} data-testid="eye-off-icon">🙈</span>,
  Mail: ({ className }: { className?: string }) => <span className={className} data-testid="mail-icon">📧</span>,
  Lock: ({ className }: { className?: string }) => <span className={className} data-testid="lock-icon">🔒</span>,
  LogIn: ({ className }: { className?: string }) => <span className={className} data-testid="login-icon">🔑</span>,
}));

describe('LoginForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnForgotPassword = jest.fn();
  const mockOnSignUp = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderLoginForm = (props: Partial<React.ComponentProps<typeof LoginForm>> = {}) => {
    return render(
      <LoginForm
        onSubmit={mockOnSubmit}
        onForgotPassword={mockOnForgotPassword}
        onSignUp={mockOnSignUp}
        {...props}
      />
    );
  };

  describe('Rendering', () => {
    it('renders login form with all elements', () => {
      renderLoginForm();
      
      expect(screen.getByText('Welcome back')).toBeInTheDocument();
      expect(screen.getByText('Enter your email and password to access your learning dashboard')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
      expect(screen.getByText('Remember me')).toBeInTheDocument();
      expect(screen.getByText('Sign in')).toBeInTheDocument();
      expect(screen.getByText('Forgot password?')).toBeInTheDocument();
      expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
      expect(screen.getByText('Sign up here')).toBeInTheDocument();
    });

    it('renders without optional callbacks', () => {
      render(<LoginForm />);
      
      expect(screen.queryByText('Forgot password?')).not.toBeInTheDocument();
      expect(screen.queryByText('Sign up here')).not.toBeInTheDocument();
    });

    it('displays error message when provided', () => {
      renderLoginForm({ error: 'Invalid credentials' });
      
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    it('shows loading state correctly', () => {
      renderLoginForm({ isLoading: true });
      
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('validates required email field', async () => {
      renderLoginForm();
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates email format', async () => {
      renderLoginForm();
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      await user.type(emailInput, 'invalid-email');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates required password field', async () => {
      renderLoginForm();
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      await user.type(emailInput, 'test@example.com');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates minimum password length', async () => {
      renderLoginForm();
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, '12345');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('clears validation errors when user starts typing', async () => {
      renderLoginForm();
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      // Trigger validation errors
      await user.click(submitButton);
      
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      
      // Start typing to clear errors
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      
      expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data', async () => {
      renderLoginForm();
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);
      
      expect(mockOnSubmit).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('prevents submission when loading', async () => {
      renderLoginForm({ isLoading: true });
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: /signing in/i });
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);
      
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('handles form submission via Enter key', async () => {
      renderLoginForm();
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.keyboard('{Enter}');
      
      expect(mockOnSubmit).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  describe('Password Visibility Toggle', () => {
    it('toggles password visibility', async () => {
      renderLoginForm();
      
      const passwordInput = screen.getByPlaceholderText('Enter your password') as HTMLInputElement;
      const toggleButton = screen.getByTestId('eye-icon').parentElement as HTMLButtonElement;
      
      expect(passwordInput.type).toBe('password');
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
      
      await user.click(toggleButton);
      
      expect(passwordInput.type).toBe('text');
      expect(screen.getByTestId('eye-off-icon')).toBeInTheDocument();
      
      await user.click(toggleButton);
      
      expect(passwordInput.type).toBe('password');
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
    });

    it('does not submit form when clicking visibility toggle', async () => {
      renderLoginForm();
      
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const toggleButton = screen.getByTestId('eye-icon').parentElement as HTMLButtonElement;
      
      await user.type(passwordInput, 'password123');
      await user.click(toggleButton);
      
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Callback Functions', () => {
    it('calls onForgotPassword when forgot password is clicked', async () => {
      renderLoginForm();
      
      const forgotPasswordButton = screen.getByText('Forgot password?');
      await user.click(forgotPasswordButton);
      
      expect(mockOnForgotPassword).toHaveBeenCalled();
    });

    it('calls onSignUp when sign up link is clicked', async () => {
      renderLoginForm();
      
      const signUpButton = screen.getByText('Sign up here');
      await user.click(signUpButton);
      
      expect(mockOnSignUp).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels and attributes', () => {
      renderLoginForm();
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autoComplete', 'email');
      expect(emailInput).toHaveAttribute('required');
      
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
      expect(passwordInput).toHaveAttribute('required');
    });

    it('has proper ARIA attributes for password toggle', () => {
      renderLoginForm();
      
      const toggleButton = screen.getByTestId('eye-icon').parentElement as HTMLButtonElement;
      expect(toggleButton).toHaveAttribute('type', 'button');
      expect(toggleButton).toHaveAttribute('tabIndex', '-1');
    });

    it('supports keyboard navigation', async () => {
      renderLoginForm();
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      await user.tab();
      expect(emailInput).toHaveFocus();
      
      await user.tab();
      expect(passwordInput).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('checkbox')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByText('Forgot password?')).toHaveFocus();
      
      await user.tab();
      expect(submitButton).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    it('displays field-specific error messages', async () => {
      renderLoginForm();
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      await user.type(emailInput, 'invalid-email');
      await user.type(passwordInput, '123');
      await user.click(submitButton);
      
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
    });

    it('prioritizes general error over field errors', () => {
      renderLoginForm({ error: 'Server error occurred' });
      
      const errorMessage = screen.getByText('Server error occurred');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveClass('text-destructive');
    });
  });

  describe('Loading State', () => {
    it('disables all interactive elements when loading', () => {
      renderLoginForm({ isLoading: true });
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: /signing in/i });
      const forgotPasswordButton = screen.getByText('Forgot password?');
      const signUpButton = screen.getByText('Sign up here');
      const rememberMeCheckbox = screen.getByRole('checkbox');
      
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();
      expect(forgotPasswordButton).toBeDisabled();
      expect(signUpButton).toBeDisabled();
      expect(rememberMeCheckbox).toBeDisabled();
    });

    it('shows loading spinner when submitting', () => {
      renderLoginForm({ isLoading: true });
      
      const loadingSpinner = screen.getByText('Signing in...');
      expect(loadingSpinner).toBeInTheDocument();
      expect(loadingSpinner.previousElementSibling).toHaveClass('animate-spin');
    });
  });

  describe('Component Props', () => {
    it('forwards className and other props', () => {
      const { container } = render(
        <LoginForm 
          className="custom-class" 
          data-testid="login-form"
          onSubmit={mockOnSubmit}
        />
      );
      
      const loginFormContainer = container.firstChild as HTMLElement;
      expect(loginFormContainer).toHaveClass('custom-class');
      expect(loginFormContainer).toHaveAttribute('data-testid', 'login-form');
    });

    it('applies forwarded ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<LoginForm ref={ref} onSubmit={mockOnSubmit} />);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Email Validation Edge Cases', () => {
    const testCases = [
      { email: '', expected: 'Email is required' },
      { email: 'invalid', expected: 'Please enter a valid email address' },
      { email: 'invalid@', expected: 'Please enter a valid email address' },
      { email: 'invalid@domain', expected: 'Please enter a valid email address' },
      { email: '@domain.com', expected: 'Please enter a valid email address' },
      { email: 'user@domain.com', expected: null },
    ];

    testCases.forEach(({ email, expected }) => {
      it(`validates email: "${email}"`, async () => {
        renderLoginForm();
        
        const emailInput = screen.getByPlaceholderText('Enter your email');
        const passwordInput = screen.getByPlaceholderText('Enter your password');
        const submitButton = screen.getByRole('button', { name: /sign in/i });
        
        if (email) {
          await user.type(emailInput, email);
        }
        await user.type(passwordInput, 'password123');
        await user.click(submitButton);
        
        if (expected) {
          expect(screen.getByText(expected)).toBeInTheDocument();
          expect(mockOnSubmit).not.toHaveBeenCalled();
        } else {
          expect(mockOnSubmit).toHaveBeenCalledWith(email, 'password123');
        }
      });
    });
  });

  describe('Form Reset', () => {
    it('maintains form state after validation errors', async () => {
      renderLoginForm();
      
      const emailInput = screen.getByPlaceholderText('Enter your email') as HTMLInputElement;
      const passwordInput = screen.getByPlaceholderText('Enter your password') as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, '123'); // Too short
      await user.click(submitButton);
      
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
      expect(emailInput.value).toBe('test@example.com');
      expect(passwordInput.value).toBe('123');
    });
  });
});