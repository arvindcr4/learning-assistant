'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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
  const { data: session, isPending } = useSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(isPending);
  }, [isPending]);

  const value = {
    user: session?.user || null,
    session: session?.session || null,
    loading,
    isAuthenticated: !!session?.user,
  };

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