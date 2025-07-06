// Enhanced API routes for learning profile management
import { NextRequest, NextResponse } from 'next/server';
import { LearningService } from '@/services/learning-service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validateQueryParams, validateRequest, UserValidationRules } from '@/utils/validation';

const learningService = new LearningService();

// GET /api/learning/profile?userId=xxx
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    
    // Use authenticated user's ID if no userId provided
    const userId = searchParams.get('userId') || request.user?.id;
    
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'User ID is required',
          message: 'Please provide a valid user ID' 
        },
        { status: 400 }
      );
    }
    
    // Check if user can access this profile
    if (request.user?.id !== userId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only access your own profile' 
        },
        { status: 403 }
      );
    }
    
    const profile = await learningService.getLearningProfile(userId);
    
    return NextResponse.json({
      success: true,
      data: profile,
      message: 'Learning profile retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching learning profile:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch learning profile',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// POST /api/learning/profile
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(body, UserValidationRules.varkResponse);
    if (!validation.isValid) {
      return validation.response!;
    }
    
    const { userId, varkResponses } = validation.validatedData;
    
    // Use authenticated user's ID if no userId provided
    const targetUserId = userId || request.user?.id;
    
    if (!targetUserId) {
      return NextResponse.json(
        { 
          error: 'User ID is required',
          message: 'Please provide a valid user ID' 
        },
        { status: 400 }
      );
    }
    
    // Check if user can create/update this profile
    if (request.user?.id !== targetUserId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only create/update your own profile' 
        },
        { status: 403 }
      );
    }
    
    const profile = await learningService.initializeLearningProfile(targetUserId, varkResponses);
    
    return NextResponse.json({
      success: true,
      data: profile,
      message: 'Learning profile initialized successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error initializing learning profile:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize learning profile',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// PUT /api/learning/profile
export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(body, UserValidationRules.profile);
    if (!validation.isValid) {
      return validation.response!;
    }
    
    const { userId, profileData } = validation.validatedData;
    
    // Use authenticated user's ID if no userId provided
    const targetUserId = userId || request.user?.id;
    
    if (!targetUserId) {
      return NextResponse.json(
        { 
          error: 'User ID is required',
          message: 'Please provide a valid user ID' 
        },
        { status: 400 }
      );
    }
    
    // Check if user can update this profile
    if (request.user?.id !== targetUserId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only update your own profile' 
        },
        { status: 403 }
      );
    }
    
    // Update learning profile with new data
    const updatedProfile = await learningService.updateLearningProfile(targetUserId, profileData);
    
    return NextResponse.json({
      success: true,
      data: updatedProfile,
      message: 'Learning profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating learning profile:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update learning profile',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// DELETE /api/learning/profile
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'User ID is required',
          message: 'Please provide a valid user ID' 
        },
        { status: 400 }
      );
    }
    
    // Check if user can delete this profile
    if (request.user?.id !== userId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only delete your own profile' 
        },
        { status: 403 }
      );
    }
    
    await learningService.deleteLearningProfile(userId);
    
    return NextResponse.json({
      success: true,
      message: 'Learning profile deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting learning profile:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete learning profile',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// HEAD /api/learning/profile - Check if profile exists
export const HEAD = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    
    if (!userId) {
      return new NextResponse(null, { status: 400 });
    }
    
    // Check if user can access this profile
    if (request.user?.id !== userId && request.user?.role !== 'admin') {
      return new NextResponse(null, { status: 403 });
    }
    
    const exists = await learningService.profileExists(userId);
    return new NextResponse(null, { status: exists ? 200 : 404 });
  } catch (error) {
    console.error('Error checking learning profile:', error);
    return new NextResponse(null, { status: 500 });
  }
});

// PATCH /api/learning/profile - Update preferences
export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { userId, preferences } = body;
    
    // Use authenticated user's ID if no userId provided
    const targetUserId = userId || request.user?.id;
    
    if (!targetUserId) {
      return NextResponse.json(
        { 
          error: 'User ID is required',
          message: 'Please provide a valid user ID' 
        },
        { status: 400 }
      );
    }
    
    // Check if user can update this profile
    if (request.user?.id !== targetUserId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only update your own preferences' 
        },
        { status: 403 }
      );
    }
    
    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { 
          error: 'Invalid preferences data',
          message: 'Preferences must be a valid object' 
        },
        { status: 400 }
      );
    }
    
    const updatedProfile = await learningService.updatePreferences(targetUserId, preferences);
    
    return NextResponse.json({
      success: true,
      data: updatedProfile,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update preferences',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});