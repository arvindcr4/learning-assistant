// Minimal auth implementation to prevent BetterAuth initialization errors
// Temporarily disabling better-auth to fix deployment issues

// Mock auth types
interface MockSession {
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  expiresAt?: Date;
}

interface MockUser {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Create a minimal auth object that won't cause initialization errors
const auth = {
  api: {
    getSession: async () => {
      // Return null session for now - can be implemented later
      return null as MockSession | null;
    },
  },
  $Infer: {
    Session: {} as MockSession,
    User: {} as MockUser,
  },
  // Add any other methods that might be called
  handlers: {
    GET: async () => {
      return new Response(JSON.stringify({ error: "Auth disabled" }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    },
    POST: async () => {
      return new Response(JSON.stringify({ error: "Auth disabled" }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    },
  }
};

export { auth };
export type Session = MockSession;
export type User = MockUser;