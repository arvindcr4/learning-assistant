'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';

import { useSession } from '@/lib/auth-client';
import type { Session, User } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const sessionResult = useSession();
  const [loading, setLoading] = useState(true);

  // Handle different return types from useSession
  const session = sessionResult?.data;
  const isPending = sessionResult?.isPending ?? sessionResult?.isLoading ?? false;

  useEffect(() => {
    setLoading(isPending);
  }, [isPending]);

  const value = useMemo(() => ({
    user: session?.user || null,
    session: session || null,
    loading,
    isAuthenticated: !!session?.user,
  }), [session, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}