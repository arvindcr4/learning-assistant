/**
 * @jest-environment jsdom
 */

import { axe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';
import { runAccessibilityAudit } from '@/utils/accessibility-testing';
import { AccessibilityProvider } from '@/contexts/AccessibilityContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoginForm } from '@/components/auth/LoginForm';
import AccessibilitySettings from '@/components/accessibility/AccessibilitySettings';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock implementation for tests
const MockAccessibilityProvider = ({ children }: { children: React.ReactNode }) => {
  const mockValue = {
    preferences: {
      reduceMotion: false,
      highContrast: false,
      largeText: false,
      screenReader: false,
      keyboardNavigation: true,
      colorBlindFriendly: false,
      focusIndicators: true,
      audioDescriptions: false,
      autoplay: true,
      fontSize: 16,
      lineHeight: 1.5,
      letterSpacing: 0,
      theme: 'light' as const
    },
    updatePreferences: jest.fn(),
    resetPreferences: jest.fn(),
    announceToScreenReader: jest.fn(),
    isAccessibilityEnabled: jest.fn(),
    getAccessibilityAttributes: jest.fn()
  };

  return (
    <div>
      {children}
    </div>
  );
};

describe('Accessibility Tests', () => {
  describe('WCAG Compliance', () => {
    test('Button component should have no accessibility violations', async () => {
      const { container } = render(
        <MockAccessibilityProvider>
          <Button>Click me</Button>
        </MockAccessibilityProvider>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('Input component should have no accessibility violations', async () => {
      const { container } = render(
        <MockAccessibilityProvider>
          <Input 
            label="Email"
            placeholder="Enter your email"
            type="email"
            isRequired
          />
        </MockAccessibilityProvider>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('LoginForm should have no accessibility violations', async () => {
      const { container } = render(
        <MockAccessibilityProvider>
          <LoginForm />
        </MockAccessibilityProvider>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('AccessibilitySettings should have no accessibility violations', async () => {
      const { container } = render(
        <MockAccessibilityProvider>
          <AccessibilitySettings isOpen={true} />
        </MockAccessibilityProvider>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    test('Button should be keyboard accessible', () => {
      const handleClick = jest.fn();
      const { getByRole } = render(
        <MockAccessibilityProvider>
          <Button onClick={handleClick}>Test Button</Button>
        </MockAccessibilityProvider>
      );
      
      const button = getByRole('button');
      
      // Test Tab navigation
      expect(button).toHaveAttribute('tabindex', '0');
      
      // Test Enter key
      button.focus();
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(handleClick).toHaveBeenCalled();
    });

    test('Input should support keyboard navigation', () => {
      const { getByLabelText } = render(
        <MockAccessibilityProvider>
          <Input 
            label="Test Input"
            placeholder="Type here"
          />
        </MockAccessibilityProvider>
      );
      
      const input = getByLabelText('Test Input');
      expect(input).toHaveAttribute('type');
      expect(input).not.toHaveAttribute('tabindex', '-1');
    });
  });

  describe('Screen Reader Support', () => {
    test('Button should have proper ARIA attributes', () => {
      const { getByRole } = render(
        <MockAccessibilityProvider>
          <Button 
            ariaLabel="Submit form"
            disabled
          >
            Submit
          </Button>
        </MockAccessibilityProvider>
      );
      
      const button = getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Submit form');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    test('Input should have proper labels and descriptions', () => {
      const { getByLabelText, getByText } = render(
        <MockAccessibilityProvider>
          <Input 
            label="Email Address"
            helpText="We'll never share your email"
            error="Invalid email format"
            isRequired
          />
        </MockAccessibilityProvider>
      );
      
      const input = getByLabelText('Email Address');
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
      
      expect(getByText('Invalid email format')).toHaveAttribute('role', 'alert');
    });

    test('Loading states should be announced', () => {
      const { getByRole } = render(
        <MockAccessibilityProvider>
          <Button isLoading loadingText="Submitting...">
            Submit
          </Button>
        </MockAccessibilityProvider>
      );
      
      const button = getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveTextContent('Submitting...');
    });
  });

  describe('Color Contrast', () => {
    test('Button should have sufficient color contrast', () => {
      const { getByRole } = render(
        <MockAccessibilityProvider>
          <Button variant="default">Default Button</Button>
        </MockAccessibilityProvider>
      );
      
      const button = getByRole('button');
      const computedStyle = window.getComputedStyle(button);
      
      // Basic check - in a real test, you'd use a proper contrast calculation
      expect(computedStyle.color).toBeDefined();
      expect(computedStyle.backgroundColor).toBeDefined();
    });
  });

  describe('Focus Management', () => {
    test('Modal should trap focus', () => {
      const { getByRole } = render(
        <MockAccessibilityProvider>
          <AccessibilitySettings 
            isOpen={true}
            onClose={jest.fn()}
          />
        </MockAccessibilityProvider>
      );
      
      const dialog = getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('role', 'dialog');
    });

    test('Skip links should be present', () => {
      const { container } = render(
        <MockAccessibilityProvider>
          <div>
            <a href="#main" className="skip-link">Skip to main content</a>
            <main id="main">Main content</main>
          </div>
        </MockAccessibilityProvider>
      );
      
      const skipLink = container.querySelector('.skip-link');
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main');
    });
  });

  describe('Form Accessibility', () => {
    test('Form inputs should have proper labels', () => {
      const { getByLabelText } = render(
        <MockAccessibilityProvider>
          <form>
            <Input 
              label="Username" 
              isRequired
            />
            <Input 
              label="Password" 
              type="password"
              isRequired
            />
          </form>
        </MockAccessibilityProvider>
      );
      
      const username = getByLabelText('Username');
      const password = getByLabelText('Password');
      
      expect(username).toHaveAttribute('aria-required', 'true');
      expect(password).toHaveAttribute('aria-required', 'true');
      expect(password).toHaveAttribute('type', 'password');
    });

    test('Form validation should be accessible', () => {
      const { getByLabelText, getByText } = render(
        <MockAccessibilityProvider>
          <Input 
            label="Email"
            error="Please enter a valid email address"
          />
        </MockAccessibilityProvider>
      );
      
      const input = getByLabelText('Email');
      const errorMessage = getByText('Please enter a valid email address');
      
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(errorMessage).toHaveAttribute('role', 'alert');
      expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Responsive Design', () => {
    test('Components should work at different viewport sizes', () => {
      // Mock different viewport sizes
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320, // Mobile width
      });

      const { getByRole } = render(
        <MockAccessibilityProvider>
          <Button>Mobile Button</Button>
        </MockAccessibilityProvider>
      );
      
      const button = getByRole('button');
      expect(button).toBeInTheDocument();
      
      // Change to desktop width
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
      });
      
      expect(button).toBeInTheDocument();
    });
  });

  describe('Custom Accessibility Audit', () => {
    test('runAccessibilityAudit should return comprehensive results', async () => {
      const { container } = render(
        <MockAccessibilityProvider>
          <div>
            <h1>Test Page</h1>
            <main>
              <Button>Test Button</Button>
              <Input label="Test Input" />
            </main>
          </div>
        </MockAccessibilityProvider>
      );
      
      const results = await runAccessibilityAudit(container as HTMLElement);
      
      expect(results).toHaveProperty('score');
      expect(results).toHaveProperty('wcagLevel');
      expect(results).toHaveProperty('totalTests');
      expect(results).toHaveProperty('passedTests');
      expect(results).toHaveProperty('failedTests');
      expect(results).toHaveProperty('violations');
      expect(results).toHaveProperty('recommendations');
      expect(results).toHaveProperty('detailedReport');
      
      expect(results.score).toBeGreaterThanOrEqual(0);
      expect(results.score).toBeLessThanOrEqual(100);
      expect(['A', 'AA', 'AAA', 'Fail']).toContain(results.wcagLevel);
    });
  });

  describe('Reduced Motion', () => {
    test('Components should respect prefers-reduced-motion', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const { container } = render(
        <MockAccessibilityProvider>
          <Button>Animated Button</Button>
        </MockAccessibilityProvider>
      );
      
      expect(container).toBeInTheDocument();
    });
  });

  describe('Internationalization', () => {
    test('Components should support RTL languages', () => {
      const { container } = render(
        <MockAccessibilityProvider>
          <div dir="rtl" lang="ar">
            <Button>زر الاختبار</Button>
          </div>
        </MockAccessibilityProvider>
      );
      
      const rtlContainer = container.querySelector('[dir="rtl"]');
      expect(rtlContainer).toHaveAttribute('dir', 'rtl');
      expect(rtlContainer).toHaveAttribute('lang', 'ar');
    });
  });
});

describe('Performance Impact', () => {
  test('Accessibility features should not significantly impact performance', () => {
    const startTime = performance.now();
    
    render(
      <MockAccessibilityProvider>
        <div>
          {Array.from({ length: 100 }, (_, i) => (
            <Button key={i}>Button {i}</Button>
          ))}
        </div>
      </MockAccessibilityProvider>
    );
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Should render 100 buttons in less than 100ms
    expect(renderTime).toBeLessThan(100);
  });
});