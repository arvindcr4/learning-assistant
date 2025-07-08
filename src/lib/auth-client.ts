// Disabled better-auth client to fix deployment issues
// import { createAuthClient } from "better-auth/react";

// Mock auth client functions
export const authClient = {
  // Add mock methods as needed
  signIn: () => Promise.resolve(null),
  signUp: () => Promise.resolve(null),
  signOut: () => Promise.resolve(null),
  getSession: () => Promise.resolve(null),
};

// Mock auth functions
export const signIn = () => Promise.resolve(null);
export const signUp = () => Promise.resolve(null);
export const signOut = () => Promise.resolve(null);
export const useSession = () => ({ data: null, isLoading: false });
export const getSession = () => Promise.resolve(null);

// Type exports for client usage
export type { Session, User } from "./auth";