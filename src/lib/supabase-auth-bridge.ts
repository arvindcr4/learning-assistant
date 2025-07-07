import { supabase } from './supabase';
import { auth } from './auth';
import { UserService, LearningProfileService } from './supabase-service';
import type { User as SupabaseUser } from '@/types/supabase';

/**
 * Bridge between Better Auth and Supabase
 * This module handles synchronization between Better Auth sessions and Supabase user data
 */

// ==========================================
// AUTH EVENT HANDLERS
// ==========================================

/**
 * Handle user sign-up event
 * Creates user record in Supabase when a new user signs up with Better Auth
 */
export async function handleUserSignUp(user: any, session: any) {
  try {
    // Check if user already exists in Supabase
    const existingUser = await UserService.getCurrentUser();
    
    if (!existingUser) {
      // Create user in Supabase
      const userData = {
        id: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        avatar_url: user.image || null,
        email_verified: user.emailVerified || false,
        metadata: {
          betterAuthId: user.id,
          createdAt: new Date().toISOString()
        }
      };

      await UserService.createUser(userData);
      
      // Create default preferences
      await UserService.createOrUpdateUserPreferences(user.id, {
        difficulty_level: 'beginner',
        daily_goal_minutes: 30,
        days_per_week: 5,
        email_notifications: true,
        push_notifications: true,
        reminder_notifications: true
      });

      console.log('Created new user in Supabase:', user.id);
    }
  } catch (error) {
    console.error('Error handling user sign up:', error);
    // Don't throw error to avoid breaking the auth flow
  }
}

/**
 * Handle user sign-in event
 * Updates user's last login and syncs data
 */
export async function handleUserSignIn(user: any, session: any) {
  try {
    // Update user's last login in Supabase
    await UserService.updateUser(user.id, {
      updated_at: new Date().toISOString()
    });

    // Sync user data if needed
    await syncUserDataFromBetterAuth(user);

    console.log('User signed in:', user.id);
  } catch (error) {
    console.error('Error handling user sign in:', error);
  }
}

/**
 * Handle user sign-out event
 */
export async function handleUserSignOut(user: any) {
  try {
    // Perform any cleanup needed
    console.log('User signed out:', user.id);
  } catch (error) {
    console.error('Error handling user sign out:', error);
  }
}

// ==========================================
// DATA SYNCHRONIZATION
// ==========================================

/**
 * Sync user data from Better Auth to Supabase
 */
export async function syncUserDataFromBetterAuth(betterAuthUser: any): Promise<SupabaseUser | null> {
  try {
    const existingUser = await UserService.getCurrentUser();
    
    if (existingUser) {
      // Update existing user with latest data from Better Auth
      const updates = {
        email: betterAuthUser.email,
        name: betterAuthUser.name || existingUser.name,
        avatar_url: betterAuthUser.image || existingUser.avatar_url,
        email_verified: betterAuthUser.emailVerified || existingUser.email_verified,
        updated_at: new Date().toISOString()
      };

      return await UserService.updateUser(existingUser.id, updates);
    } else {
      // Create new user if doesn't exist
      const userData = {
        id: betterAuthUser.id,
        email: betterAuthUser.email,
        name: betterAuthUser.name || betterAuthUser.email.split('@')[0],
        avatar_url: betterAuthUser.image || null,
        email_verified: betterAuthUser.emailVerified || false,
        metadata: {
          betterAuthId: betterAuthUser.id,
          syncedAt: new Date().toISOString()
        }
      };

      return await UserService.createUser(userData);
    }
  } catch (error) {
    console.error('Error syncing user data:', error);
    return null;
  }
}

/**
 * Sync user data from Supabase to Better Auth
 */
export async function syncUserDataToBetterAuth(supabaseUser: SupabaseUser) {
  try {
    // Update Better Auth user data if needed
    // This is typically handled by Better Auth itself
    console.log('Syncing data to Better Auth for user:', supabaseUser.id);
  } catch (error) {
    console.error('Error syncing data to Better Auth:', error);
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get unified user data from both Better Auth and Supabase
 */
export async function getUnifiedUserData(): Promise<{
  betterAuthUser: any;
  supabaseUser: SupabaseUser | null;
  preferences: any;
  learningProfile: any;
} | null> {
  try {
    // Get Better Auth session
    const session = await auth.api.getSession({
      headers: typeof window !== 'undefined' ? {} : new Headers()
    });

    if (!session?.user) {
      return null;
    }

    // Get Supabase user data
    const supabaseUser = await UserService.getCurrentUser();
    const preferences = supabaseUser ? await UserService.getUserPreferences(supabaseUser.id) : null;
    const learningProfile = supabaseUser ? await LearningProfileService.getLearningProfile(supabaseUser.id) : null;

    return {
      betterAuthUser: session.user,
      supabaseUser,
      preferences,
      learningProfile
    };
  } catch (error) {
    console.error('Error getting unified user data:', error);
    return null;
  }
}

/**
 * Initialize user's learning profile after first sign-up
 */
export async function initializeUserLearningProfile(userId: string) {
  try {
    // Check if profile already exists
    const existingProfile = await LearningProfileService.getLearningProfile(userId);
    
    if (!existingProfile) {
      // Create default learning profile
      await LearningProfileService.createOrUpdateLearningProfile(userId, {
        dominant_style: 'reading', // Default to reading style
        is_multimodal: false,
        adaptation_level: 0,
        confidence_score: 0.0
      });

      console.log('Initialized learning profile for user:', userId);
    }
  } catch (error) {
    console.error('Error initializing learning profile:', error);
  }
}

// ==========================================
// SUPABASE AUTH STATE MANAGEMENT
// ==========================================

/**
 * Set up Supabase auth state listener to sync with Better Auth
 */
export function setupAuthStateListener() {
  // Listen to auth state changes in Supabase
  supabase.auth.onAuthStateChange(async (event, session) => {
    try {
      switch (event) {
        case 'SIGNED_IN':
          if (session?.user) {
            console.log('Supabase user signed in:', session.user.id);
            // Sync with Better Auth if needed
          }
          break;
          
        case 'SIGNED_OUT':
          console.log('Supabase user signed out');
          break;
          
        case 'TOKEN_REFRESHED':
          console.log('Supabase token refreshed');
          break;
          
        default:
          break;
      }
    } catch (error) {
      console.error('Error in auth state change handler:', error);
    }
  });
}

// ==========================================
// MIDDLEWARE INTEGRATION
// ==========================================

/**
 * Middleware function to ensure user data is synced
 */
export async function ensureUserDataSync(request: Request): Promise<Response | null> {
  try {
    // This would typically be called from Next.js middleware
    // to ensure user data is synced on protected routes
    
    const unifiedData = await getUnifiedUserData();
    
    if (unifiedData?.betterAuthUser && !unifiedData.supabaseUser) {
      // User exists in Better Auth but not in Supabase - sync them
      await syncUserDataFromBetterAuth(unifiedData.betterAuthUser);
    }
    
    return null; // Continue with request
  } catch (error) {
    console.error('Error in user data sync middleware:', error);
    return null; // Continue with request even if sync fails
  }
}

// ==========================================
// EXPORTS
// ==========================================

export const SupabaseAuthBridge = {
  handleUserSignUp,
  handleUserSignIn,
  handleUserSignOut,
  syncUserDataFromBetterAuth,
  syncUserDataToBetterAuth,
  getUnifiedUserData,
  initializeUserLearningProfile,
  setupAuthStateListener,
  ensureUserDataSync
};