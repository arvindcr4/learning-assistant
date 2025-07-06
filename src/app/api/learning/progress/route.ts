// Comprehensive progress tracking API routes
import { NextRequest, NextResponse } from 'next/server';
import { LearningService } from '@/services/learning-service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validateRequest, validateQueryParams } from '@/utils/validation';

const learningService = new LearningService();

// GET /api/learning/progress?userId=xxx&timeRange=30&granularity=daily
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    const timeRange = parseInt(searchParams.get('timeRange') || '30');
    const granularity = searchParams.get('granularity') || 'daily'; // daily, weekly, monthly
    const includeDetails = searchParams.get('includeDetails') === 'true';
    const contentType = searchParams.get('contentType'); // filter by content type
    
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'User ID is required',
          message: 'Please provide a valid user ID' 
        },
        { status: 400 }
      );
    }
    
    // Check authorization
    if (request.user?.id !== userId && request.user?.role !== 'admin' && request.user?.role !== 'educator') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only access your own progress data' 
        },
        { status: 403 }
      );
    }
    
    const progress = await learningService.getProgressData(userId, {
      timeRange: Math.min(timeRange, 365), // Max 1 year
      granularity,
      includeDetails,
      contentType
    });
    
    return NextResponse.json({
      success: true,
      data: progress,
      message: 'Progress data retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching progress data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch progress data',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// POST /api/learning/progress/update - Update progress manually
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { userId, contentId, progress, metadata } = body;
    
    const targetUserId = userId || request.user?.id;
    
    if (!targetUserId || !contentId) {
      return NextResponse.json(
        { 
          error: 'User ID and Content ID are required',
          message: 'Please provide valid user ID and content ID' 
        },
        { status: 400 }
      );
    }
    
    // Check authorization
    if (request.user?.id !== targetUserId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only update your own progress' 
        },
        { status: 403 }
      );
    }
    
    // Validate progress data
    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      return NextResponse.json(
        { 
          error: 'Invalid progress value',
          message: 'Progress must be a number between 0 and 100' 
        },
        { status: 400 }
      );
    }
    
    const updatedProgress = await learningService.updateProgress(targetUserId, contentId, {
      progress,
      metadata,
      lastAccessed: new Date()
    });
    
    return NextResponse.json({
      success: true,
      data: updatedProgress,
      message: 'Progress updated successfully'
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update progress',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// PUT /api/learning/progress/complete - Mark content as completed
export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { userId, contentId, completionData } = body;
    
    const targetUserId = userId || request.user?.id;
    
    if (!targetUserId || !contentId) {
      return NextResponse.json(
        { 
          error: 'User ID and Content ID are required',
          message: 'Please provide valid user ID and content ID' 
        },
        { status: 400 }
      );
    }
    
    // Check authorization
    if (request.user?.id !== targetUserId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only mark your own content as completed' 
        },
        { status: 403 }
      );
    }
    
    const completion = await learningService.markContentCompleted(targetUserId, contentId, {
      completedAt: new Date(),
      score: completionData?.score,
      timeSpent: completionData?.timeSpent,
      notes: completionData?.notes
    });
    
    return NextResponse.json({
      success: true,
      data: completion,
      message: 'Content marked as completed successfully'
    });
  } catch (error) {
    console.error('Error marking content as completed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to mark content as completed',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// DELETE /api/learning/progress - Reset progress
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    const contentId = searchParams.get('contentId');
    const resetType = searchParams.get('resetType') || 'progress'; // 'progress', 'completion', 'all'
    
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'User ID is required',
          message: 'Please provide a valid user ID' 
        },
        { status: 400 }
      );
    }
    
    // Check authorization
    if (request.user?.id !== userId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only reset your own progress' 
        },
        { status: 403 }
      );
    }
    
    if (contentId) {
      // Reset specific content progress
      await learningService.resetContentProgress(userId, contentId, resetType);
    } else {
      // Reset all progress for user
      await learningService.resetAllProgress(userId, resetType);
    }
    
    return NextResponse.json({
      success: true,
      message: `Progress reset successfully (${resetType})`
    });
  } catch (error) {
    console.error('Error resetting progress:', error);
    return NextResponse.json(
      { 
        error: 'Failed to reset progress',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});