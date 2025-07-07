import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { user } from '../../utils/test-utils';

// Mock the icons
jest.mock('lucide-react', () => ({
  Eye: ({ className }: { className?: string }) => <span className={className} data-testid="eye-icon">👁</span>,
  EyeOff: ({ className }: { className?: string }) => <span className={className} data-testid="eye-off-icon">🙈</span>,
  Mail: ({ className }: { className?: string }) => <span className={className} data-testid="mail-icon">📧</span>,
  Lock: ({ className }: { className?: string }) => <span className={className} data-testid="lock-icon">🔒</span>,
  User: ({ className }: { className?: string }) => <span className={className} data-testid="user-icon">👤</span>,
  UserPlus: ({ className }: { className?: string }) => <span className={className} data-testid="user-plus-icon">👥</span>,
}));

describe('RegisterForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnSignIn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderRegisterForm = (props: Partial<React.ComponentProps<typeof RegisterForm>> = {}) => {
    return render(
      <RegisterForm
        onSubmit={mockOnSubmit}
        onSignIn={mockOnSignIn}
        {...props}
      />
    );
  };

  describe('Rendering', () => {
    it('renders registration form with all elements', () => {
      renderRegisterForm();
      
      expect(screen.getByText('Create account')).toBeInTheDocument();
      expect(screen.getByText('Join our learning community and start your personalized learning journey')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your full name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Create a password')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument();
      expect(screen.getByText('I agree to the')).toBeInTheDocument();
      expect(screen.getByText('Terms of Service')).toBeInTheDocument();
      expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
      expect(screen.getByText('Create account')).toBeInTheDocument();
    });

    it('renders without optional callbacks', () => {
      render(<RegisterForm />);
      
      expect(screen.queryByText('Sign in here')).not.toBeInTheDocument();
    });

    it('displays error message when provided', () => {
      renderRegisterForm({ error: 'Email already exists' });
      
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });

    it('shows loading state correctly', () => {
      renderRegisterForm({ isLoading: true });
      
      expect(screen.getByText('Creating account...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('validates required name field', async () => {
      renderRegisterForm();
      
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates minimum name length', async () => {
      renderRegisterForm();
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      await user.type(nameInput, 'A');
      
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates required email field', async () => {
      renderRegisterForm();
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      await user.type(nameInput, 'John Doe');
      
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates email format', async () => {
      renderRegisterForm();
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'invalid-email');
      
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates required password field', async () => {
      renderRegisterForm();
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates password minimum length', async () => {
      renderRegisterForm();
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, '1234567');
      
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates password complexity', async () => {
      renderRegisterForm();
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'password'); // Missing uppercase and numbers
      
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Password must contain uppercase, lowercase, and numbers')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates confirm password field', async () => {
      renderRegisterForm();
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123');
      
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates password confirmation match', async () => {
      renderRegisterForm();
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
      
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password456');
      
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);
      
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('clears validation errors when user starts typing', async () => {
      renderRegisterForm();
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      // Trigger validation errors
      await user.click(submitButton);
      
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
      
      // Start typing to clear errors
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password123');
      
      expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Please confirm your password')).not.toBeInTheDocument();
    });
  });

  describe('Password Strength Indicator', () => {
    it('shows password strength indicator when password is entered', async () => {
      renderRegisterForm();
      
      const passwordInput = screen.getByPlaceholderText('Create a password');
      await user.type(passwordInput, 'P');
      
      expect(screen.getByText('Password strength:')).toBeInTheDocument();
    });

    it('updates password strength as user types', async () => {
      renderRegisterForm();
      
      const passwordInput = screen.getByPlaceholderText('Create a password');
      
      // Type a weak password
      await user.type(passwordInput, 'password');
      
      const strengthIndicators = screen.getAllByRole('generic').filter(
        el => el.className.includes('h-1 w-1/4 rounded')
      );
      
      expect(strengthIndicators).toHaveLength(4);
      
      // Clear and type a strong password
      await user.clear(passwordInput);
      await user.type(passwordInput, 'Password123');
      
      // All strength indicators should be active
      const activeIndicators = screen.getAllByRole('generic').filter(
        el => el.className.includes('bg-learning-secondary')
      );
      
      expect(activeIndicators.length).toBeGreaterThan(0);
    });

    it('hides password strength indicator when password is empty', async () => {
      renderRegisterForm();
      
      const passwordInput = screen.getByPlaceholderText('Create a password');
      
      // Type and then clear
      await user.type(passwordInput, 'Password123');
      expect(screen.getByText('Password strength:')).toBeInTheDocument();
      
      await user.clear(passwordInput);
      expect(screen.queryByText('Password strength:')).not.toBeInTheDocument();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('toggles password visibility for password field', async () => {
      renderRegisterForm();
      
      const passwordInput = screen.getByPlaceholderText('Create a password') as HTMLInputElement;
      const toggleButton = screen.getAllByTestId('eye-icon')[0].parentElement as HTMLButtonElement;
      
      expect(passwordInput.type).toBe('password');
      expect(screen.getAllByTestId('eye-icon')[0]).toBeInTheDocument();
      
      await user.click(toggleButton);
      
      expect(passwordInput.type).toBe('text');
      expect(screen.getAllByTestId('eye-off-icon')[0]).toBeInTheDocument();
    });

    it('toggles password visibility for confirm password field', async () => {
      renderRegisterForm();
      
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password') as HTMLInputElement;
      const toggleButton = screen.getAllByTestId('eye-icon')[1].parentElement as HTMLButtonElement;
      
      expect(confirmPasswordInput.type).toBe('password');
      expect(screen.getAllByTestId('eye-icon')[1]).toBeInTheDocument();
      
      await user.click(toggleButton);
      
      expect(confirmPasswordInput.type).toBe('text');
      expect(screen.getAllByTestId('eye-off-icon')[1]).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data', async () => {
      renderRegisterForm();
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
      const termsCheckbox = screen.getByRole('checkbox');
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password123');
      await user.click(termsCheckbox);
      await user.click(submitButton);
      
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      });
    });

    it('trims whitespace from name field', async () => {
      renderRegisterForm();
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
      const termsCheckbox = screen.getByRole('checkbox');
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      await user.type(nameInput, '  John Doe  ');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password123');
      await user.click(termsCheckbox);
      await user.click(submitButton);
      
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      });
    });

    it('prevents submission when loading', async () => {
      renderRegisterForm({ isLoading: true });
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
      const submitButton = screen.getByRole('button', { name: /creating account/i });
      
      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password123');
      await user.click(submitButton);
      
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Password Complexity Edge Cases', () => {
    const testCases = [
      {
        password: 'Password123',
        expected: null, // Valid
        description: 'valid password with all requirements',
      },
      {
        password: 'password123',
        expected: 'Password must contain uppercase, lowercase, and numbers',
        description: 'password without uppercase',
      },
      {
        password: 'PASSWORD123',
        expected: 'Password must contain uppercase, lowercase, and numbers',
        description: 'password without lowercase',
      },
      {
        password: 'Password',
        expected: 'Password must contain uppercase, lowercase, and numbers',
        description: 'password without numbers',
      },
      {
        password: 'Pass1',
        expected: 'Password must be at least 8 characters',
        description: 'password too short',
      },
    ];

    testCases.forEach(({ password, expected, description }) => {
      it(`validates ${description}`, async () => {
        renderRegisterForm();
        
        const nameInput = screen.getByPlaceholderText('Enter your full name');
        const emailInput = screen.getByPlaceholderText('Enter your email');
        const passwordInput = screen.getByPlaceholderText('Create a password');
        const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
        const submitButton = screen.getByRole('button', { name: /create account/i });
        
        await user.type(nameInput, 'John Doe');
        await user.type(emailInput, 'john@example.com');
        await user.type(passwordInput, password);
        await user.type(confirmPasswordInput, password);
        await user.click(submitButton);
        
        if (expected) {
          expect(screen.getByText(expected)).toBeInTheDocument();
          expect(mockOnSubmit).not.toHaveBeenCalled();
        } else {
          expect(mockOnSubmit).toHaveBeenCalledWith({
            name: 'John Doe',
            email: 'john@example.com',
            password: password,
          });
        }
      });
    });
  });

  describe('Callback Functions', () => {
    it('calls onSignIn when sign in link is clicked', async () => {
      renderRegisterForm();
      
      const signInButton = screen.getByText('Sign in here');
      await user.click(signInButton);
      
      expect(mockOnSignIn).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels and attributes', () => {
      renderRegisterForm();
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
      
      expect(nameInput).toHaveAttribute('type', 'text');
      expect(nameInput).toHaveAttribute('autoComplete', 'name');
      expect(nameInput).toHaveAttribute('required');
      
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autoComplete', 'email');
      expect(emailInput).toHaveAttribute('required');
      
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('autoComplete', 'new-password');
      expect(passwordInput).toHaveAttribute('required');
      
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');
      expect(confirmPasswordInput).toHaveAttribute('autoComplete', 'new-password');
      expect(confirmPasswordInput).toHaveAttribute('required');
    });

    it('has proper ARIA attributes for password toggles', () => {
      renderRegisterForm();
      
      const toggleButtons = screen.getAllByTestId('eye-icon').map(icon => icon.parentElement as HTMLButtonElement);
      
      toggleButtons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button');
        expect(button).toHaveAttribute('tabIndex', '-1');
      });
    });

    it('supports keyboard navigation', async () => {
      renderRegisterForm();
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
      const termsCheckbox = screen.getByRole('checkbox');
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      await user.tab();
      expect(nameInput).toHaveFocus();
      
      await user.tab();
      expect(emailInput).toHaveFocus();
      
      await user.tab();
      expect(passwordInput).toHaveFocus();
      
      await user.tab();
      expect(confirmPasswordInput).toHaveFocus();
      
      await user.tab();
      expect(termsCheckbox).toHaveFocus();
      
      await user.tab();
      expect(submitButton).toHaveFocus();
    });
  });

  describe('Loading State', () => {
    it('disables all interactive elements when loading', () => {
      renderRegisterForm({ isLoading: true });
      
      const nameInput = screen.getByPlaceholderText('Enter your full name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
      const submitButton = screen.getByRole('button', { name: /creating account/i });
      const signInButton = screen.getByText('Sign in here');
      const termsCheckbox = screen.getByRole('checkbox');
      
      expect(nameInput).toBeDisabled();
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(confirmPasswordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();
      expect(signInButton).toBeDisabled();
      expect(termsCheckbox).toBeDisabled();
    });

    it('shows loading spinner when submitting', () => {
      renderRegisterForm({ isLoading: true });
      
      const loadingSpinner = screen.getByText('Creating account...');
      expect(loadingSpinner).toBeInTheDocument();
      expect(loadingSpinner.previousElementSibling).toHaveClass('animate-spin');
    });
  });

  describe('Terms and Conditions', () => {
    it('requires terms checkbox to be checked', () => {
      renderRegisterForm();
      
      const termsCheckbox = screen.getByRole('checkbox');
      expect(termsCheckbox).toHaveAttribute('required');
    });

    it('has clickable terms links', () => {
      renderRegisterForm();
      
      const termsLink = screen.getByText('Terms of Service');
      const privacyLink = screen.getByText('Privacy Policy');
      
      expect(termsLink).toHaveAttribute('href', '#');
      expect(privacyLink).toHaveAttribute('href', '#');
    });
  });

  describe('Component Props', () => {
    it('forwards className and other props', () => {
      const { container } = render(
        <RegisterForm 
          className="custom-class" 
          data-testid="register-form"
          onSubmit={mockOnSubmit}
        />
      );
      
      const registerFormContainer = container.firstChild as HTMLElement;
      expect(registerFormContainer).toHaveClass('custom-class');
      expect(registerFormContainer).toHaveAttribute('data-testid', 'register-form');
    });

    it('applies forwarded ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<RegisterForm ref={ref} onSubmit={mockOnSubmit} />);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });
});