import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Environment variables validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.'
  );
}

// Create Supabase client with configuration
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configure auth behavior
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // Use PKCE flow for enhanced security
    
    // Storage configuration
    storage: {
      // Use custom storage if needed (e.g., for React Native)
      getItem: (key: string) => {
        if (typeof window === 'undefined') return null;
        return window.localStorage.getItem(key);
      },
      setItem: (key: string, value: string) => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem(key);
      },
    },
  },
  
  // Real-time configuration
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  
  // Database configuration
  db: {
    schema: 'public',
  },
  
  // Global configuration
  global: {
    headers: {
      'X-Client-Info': 'learning-assistant',
    },
  },
});

// Server-side Supabase client for API routes and server components
export const createServerClient = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseServiceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. This is required for server-side operations.'
    );
  }
  
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'learning-assistant-server',
      },
    },
  });
};

// Helper function to get user session
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  
  return session;
};

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  
  return user;
};

// Helper function to sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Helper function to check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  const session = await getSession();
  return !!session;
};

// Type exports for better TypeScript support
export type SupabaseClient = typeof supabase;
export type { Database } from '@/types/supabase';