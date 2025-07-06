// Enhanced learning recommendations API routes
import { NextRequest, NextResponse } from 'next/server';
import { LearningService } from '@/services/learning-service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validateRequest } from '@/utils/validation';

const learningService = new LearningService();

// GET /api/learning/recommendations?userId=xxx&type=content&limit=10
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    const type = searchParams.get('type') || 'all'; // content, pace, style, schedule, goal
    const limit = parseInt(searchParams.get('limit') || '10');
    const priority = searchParams.get('priority'); // high, medium, low
    const includeReasoning = searchParams.get('includeReasoning') === 'true';
    
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
          message: 'You can only access your own recommendations' 
        },
        { status: 403 }
      );
    }
    
    const recommendations = await learningService.getPersonalizedRecommendations(userId, {
      type,
      limit: Math.min(limit, 50),
      priority,
      includeReasoning
    });
    
    return NextResponse.json({
      success: true,
      data: recommendations,
      metadata: {
        totalRecommendations: recommendations.length,
        types: [...new Set(recommendations.map(r => r.type))],
        priorities: [...new Set(recommendations.map(r => r.priority))]
      },
      message: 'Recommendations retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch recommendations',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// POST /api/learning/recommendations/feedback
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { userId, recommendationId, feedback, rating, action } = body;
    
    const targetUserId = userId || request.user?.id;
    
    if (!targetUserId || !recommendationId || !feedback) {
      return NextResponse.json(
        { 
          error: 'User ID, recommendation ID, and feedback are required',
          message: 'Please provide all required fields' 
        },
        { status: 400 }
      );
    }
    
    // Check authorization
    if (request.user?.id !== targetUserId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only provide feedback for your own recommendations' 
        },
        { status: 403 }
      );
    }
    
    const feedbackResult = await learningService.processRecommendationFeedback(targetUserId, recommendationId, {
      feedback,
      rating: Math.min(Math.max(rating || 5, 1), 10),
      action: action || 'viewed', // viewed, accepted, declined, ignored
      providedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      data: feedbackResult,
      message: 'Recommendation feedback processed successfully'
    });
  } catch (error) {
    console.error('Error processing recommendation feedback:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process recommendation feedback',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// PUT /api/learning/recommendations/refresh - Force refresh recommendations
export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { userId, forceRecalculate = false } = body;
    
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
    if (request.user?.id !== targetUserId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only refresh your own recommendations' 
        },
        { status: 403 }
      );
    }
    
    const refreshedRecommendations = await learningService.refreshRecommendations(targetUserId, {
      forceRecalculate,
      requestedBy: request.user.id,
      requestedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      data: refreshedRecommendations,
      message: 'Recommendations refreshed successfully'
    });
  } catch (error) {
    console.error('Error refreshing recommendations:', error);
    return NextResponse.json(
      { 
        error: 'Failed to refresh recommendations',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// DELETE /api/learning/recommendations/:id - Dismiss recommendation
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const recommendationId = searchParams.get('id');
    const userId = searchParams.get('userId') || request.user?.id;
    const reason = searchParams.get('reason') || 'dismissed';
    
    if (!recommendationId || !userId) {
      return NextResponse.json(
        { 
          error: 'Recommendation ID and User ID are required',
          message: 'Please provide valid recommendation ID and user ID' 
        },
        { status: 400 }
      );
    }
    
    // Check authorization
    if (request.user?.id !== userId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only dismiss your own recommendations' 
        },
        { status: 403 }
      );
    }
    
    await learningService.dismissRecommendation(recommendationId, userId, {
      reason,
      dismissedBy: request.user.id,
      dismissedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Recommendation dismissed successfully'
    });
  } catch (error) {
    console.error('Error dismissing recommendation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to dismiss recommendation',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});