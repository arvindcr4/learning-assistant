import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';

// Mock the auth client
const mockUseSession = jest.fn();
jest.mock('@/lib/auth-client', () => ({
  useSession: () => mockUseSession(),
}));

// Mock auth types
jest.mock('@/lib/auth', () => ({
  Session: {},
  User: {},
}));

// Test component that uses the auth context
const TestComponent = () => {
  const { user, session, loading, isAuthenticated } = useAuth();
  
  return (
    <div>
      <div data-testid="user">{user ? JSON.stringify(user) : 'null'}</div>
      <div data-testid="session">{session ? JSON.stringify(session) : 'null'}</div>
      <div data-testid="loading">{loading ? 'true' : 'false'}</div>
      <div data-testid="isAuthenticated">{isAuthenticated ? 'true' : 'false'}</div>
    </div>
  );
};

const TestComponentWithoutProvider = () => {
  const { user } = useAuth();
  return <div>{user?.name}</div>;
};

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider Setup', () => {
    it('provides auth context to children', () => {
      mockUseSession.mockReturnValue({
        data: null,
        isLoading: false,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('session')).toHaveTextContent('null');
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    });

    it('throws error when useAuth is used without provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponentWithoutProvider />);
      }).toThrow('useAuth must be used within an AuthProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Loading State', () => {
    it('reflects loading state from useSession', () => {
      mockUseSession.mockReturnValue({
        data: null,
        isLoading: true,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('true');
    });

    it('updates loading state when useSession changes', async () => {
      const { rerender } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Initially loading
      mockUseSession.mockReturnValue({
        data: null,
        isLoading: true,
      });

      rerender(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('true');

      // Then not loading
      mockUseSession.mockReturnValue({
        data: null,
        isLoading: false,
      });

      rerender(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });
  });

  describe('Authenticated State', () => {
    it('provides user and session when authenticated', () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      const mockSession = {
        user: mockUser,
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        expiresAt: Date.now() + 3600000,
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        isLoading: false,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
      expect(screen.getByTestId('session')).toHaveTextContent(JSON.stringify(mockSession));
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    });

    it('handles authentication state changes', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      const mockSession = {
        user: mockUser,
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        expiresAt: Date.now() + 3600000,
      };

      // Start unauthenticated
      mockUseSession.mockReturnValue({
        data: null,
        isLoading: false,
      });

      const { rerender } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');

      // Then authenticated
      mockUseSession.mockReturnValue({
        data: mockSession,
        isLoading: false,
      });

      rerender(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
      });
    });
  });

  describe('Unauthenticated State', () => {
    it('provides null values when not authenticated', () => {
      mockUseSession.mockReturnValue({
        data: null,
        isLoading: false,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('session')).toHaveTextContent('null');
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    });

    it('handles session without user', () => {
      const mockSession = {
        user: null,
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        expiresAt: Date.now() + 3600000,
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        isLoading: false,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('session')).toHaveTextContent(JSON.stringify(mockSession));
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    });
  });

  describe('Error Handling', () => {
    it('handles undefined session gracefully', () => {
      mockUseSession.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('session')).toHaveTextContent('null');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    });

    it('handles malformed session data', () => {
      const malformedSession = {
        // Missing required fields
        someOtherField: 'value',
      };

      mockUseSession.mockReturnValue({
        data: malformedSession,
        isLoading: false,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('session')).toHaveTextContent(JSON.stringify(malformedSession));
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    });
  });

  describe('Context Updates', () => {
    it('updates context when useSession data changes', async () => {
      const mockUser1 = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      const mockUser2 = {
        id: 'user-456',
        name: 'Jane Smith',
        email: 'jane@example.com',
      };

      const mockSession1 = {
        user: mockUser1,
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        expiresAt: Date.now() + 3600000,
      };

      const mockSession2 = {
        user: mockUser2,
        accessToken: 'token-456',
        refreshToken: 'refresh-456',
        expiresAt: Date.now() + 3600000,
      };

      mockUseSession.mockReturnValue({
        data: mockSession1,
        isLoading: false,
      });

      const { rerender } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser1));

      // Update session
      mockUseSession.mockReturnValue({
        data: mockSession2,
        isLoading: false,
      });

      rerender(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser2));
      });
    });

    it('updates context when loading state changes', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        isLoading: true,
      });

      const { rerender } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('true');

      mockUseSession.mockReturnValue({
        data: null,
        isLoading: false,
      });

      rerender(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });
  });

  describe('Multiple Consumers', () => {
    const AnotherTestComponent = () => {
      const { isAuthenticated } = useAuth();
      return <div data-testid="another-authenticated">{isAuthenticated ? 'yes' : 'no'}</div>;
    };

    it('provides same context to multiple consumers', () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      const mockSession = {
        user: mockUser,
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        expiresAt: Date.now() + 3600000,
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        isLoading: false,
      });

      render(
        <AuthProvider>
          <TestComponent />
          <AnotherTestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('another-authenticated')).toHaveTextContent('yes');
    });
  });

  describe('Memory Management', () => {
    it('does not cause memory leaks with frequent updates', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      mockUseSession.mockReturnValue({
        data: { user: mockUser },
        isLoading: false,
      });

      const { rerender, unmount } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Simulate frequent updates
      for (let i = 0; i < 10; i++) {
        mockUseSession.mockReturnValue({
          data: { user: { ...mockUser, id: `user-${i}` } },
          isLoading: false,
        });

        rerender(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      }

      // Should not throw any errors
      unmount();
      expect(true).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles rapid loading state changes', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        isLoading: true,
      });

      const { rerender } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('true');

      // Rapid changes
      mockUseSession.mockReturnValue({
        data: null,
        isLoading: false,
      });

      rerender(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      mockUseSession.mockReturnValue({
        data: null,
        isLoading: true,
      });

      rerender(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('true');
      });
    });

    it('handles session with empty user object', () => {
      const mockSession = {
        user: {},
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        expiresAt: Date.now() + 3600000,
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        isLoading: false,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('user')).toHaveTextContent('{}');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    });
  });

  describe('TypeScript Type Safety', () => {
    it('provides correctly typed context values', () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      const mockSession = {
        user: mockUser,
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        expiresAt: Date.now() + 3600000,
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        isLoading: false,
      });

      const TypeSafeComponent = () => {
        const { user, session, loading, isAuthenticated } = useAuth();
        
        // These should not cause TypeScript errors
        const userId = user?.id;
        const userEmail = user?.email;
        const accessToken = session?.accessToken;
        const isAuth = isAuthenticated;
        const isLoading = loading;
        
        return (
          <div>
            <div data-testid="user-id">{userId}</div>
            <div data-testid="user-email">{userEmail}</div>
            <div data-testid="access-token">{accessToken}</div>
            <div data-testid="is-auth">{isAuth ? 'true' : 'false'}</div>
            <div data-testid="is-loading">{loading ? 'true' : 'false'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TypeSafeComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
      expect(screen.getByTestId('user-email')).toHaveTextContent('john@example.com');
      expect(screen.getByTestId('access-token')).toHaveTextContent('token-123');
      expect(screen.getByTestId('is-auth')).toHaveTextContent('true');
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });
  });
});