import { auth } from './auth';
import { headers } from 'next/headers';

/**
 * Get the current session on the server side
 */
export async function getServerSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session;
  } catch (error) {
    console.error('Error getting server session:', error);
    return null;
  }
}

/**
 * Check if user is authenticated on the server side
 */
export async function isAuthenticated() {
  const session = await getServerSession();
  return !!session;
}

/**
 * Require authentication on the server side
 * Throws an error if user is not authenticated
 */
export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    throw new Error('Authentication required');
  }
  return session;
}

/**
 * Get user role from session
 */
export async function getUserRole() {
  const session = await getServerSession();
  return session?.user?.role || 'user';
}

/**
 * Check if user has specific role
 */
export async function hasRole(role: string) {
  const userRole = await getUserRole();
  return userRole === role;
}

/**
 * Password validation helper
 */
export function validatePassword(password: string): string[] {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return errors;
}

/**
 * Email validation helper
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}