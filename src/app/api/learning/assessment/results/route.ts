// Assessment results API routes
import { NextRequest, NextResponse } from 'next/server';
import { LearningService } from '@/services/learning-service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validateQueryParams } from '@/utils/validation';

const learningService = new LearningService();

// GET /api/learning/assessment/results?userId=xxx&assessmentId=xxx&limit=10&offset=0
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    const assessmentId = searchParams.get('assessmentId');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeDetails = searchParams.get('includeDetails') === 'true';
    
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
          message: 'You can only access your own assessment results' 
        },
        { status: 403 }
      );
    }
    
    let results;
    if (assessmentId) {
      // Get specific assessment result
      const result = await learningService.getAssessmentResult(assessmentId, userId, includeDetails);
      if (!result) {
        return NextResponse.json(
          { 
            error: 'Assessment result not found',
            message: 'No result found for this assessment' 
          },
          { status: 404 }
        );
      }
      results = [result];
    } else {
      // Get all assessment results for user
      results = await learningService.getAssessmentResults(userId, {
        limit: Math.min(limit, 100),
        offset: Math.max(offset, 0),
        includeDetails
      });
    }
    
    return NextResponse.json({
      success: true,
      data: results,
      pagination: assessmentId ? null : {
        limit,
        offset,
        total: results.length,
        hasMore: results.length === limit
      },
      message: 'Assessment results retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching assessment results:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch assessment results',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// GET /api/learning/assessment/results/analytics?userId=xxx&timeRange=30
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { userId, timeRange = 30, metrics = [] } = body;
    
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
    
    // Check authorization
    if (request.user?.id !== targetUserId && request.user?.role !== 'admin' && request.user?.role !== 'educator') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only access your own assessment analytics' 
        },
        { status: 403 }
      );
    }
    
    const analytics = await learningService.getAssessmentAnalytics(targetUserId, {
      timeRange,
      metrics
    });
    
    return NextResponse.json({
      success: true,
      data: analytics,
      message: 'Assessment analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching assessment analytics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch assessment analytics',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// PUT /api/learning/assessment/results/feedback - Add feedback to result
export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { assessmentId, userId, feedback, rating } = body;
    
    if (!assessmentId || !userId || !feedback) {
      return NextResponse.json(
        { 
          error: 'Assessment ID, User ID, and feedback are required',
          message: 'Please provide all required fields' 
        },
        { status: 400 }
      );
    }
    
    // Only educators and admins can provide feedback
    if (request.user?.role !== 'admin' && request.user?.role !== 'educator') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Only educators and admins can provide feedback' 
        },
        { status: 403 }
      );
    }
    
    const updatedResult = await learningService.addAssessmentFeedback(assessmentId, userId, {
      feedback,
      rating,
      providedBy: request.user.id,
      providedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      data: updatedResult,
      message: 'Feedback added successfully'
    });
  } catch (error) {
    console.error('Error adding assessment feedback:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add assessment feedback',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// DELETE /api/learning/assessment/results - Delete assessment result
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessmentId');
    const userId = searchParams.get('userId') || request.user?.id;
    
    if (!assessmentId || !userId) {
      return NextResponse.json(
        { 
          error: 'Assessment ID and User ID are required',
          message: 'Please provide valid assessment ID and user ID' 
        },
        { status: 400 }
      );
    }
    
    // Check authorization - only admin or the user themselves can delete results
    if (request.user?.id !== userId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only delete your own assessment results' 
        },
        { status: 403 }
      );
    }
    
    await learningService.deleteAssessmentResult(assessmentId, userId);
    
    return NextResponse.json({
      success: true,
      message: 'Assessment result deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assessment result:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete assessment result',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});