// Learning goals management API routes
import { NextRequest, NextResponse } from 'next/server';
import { LearningService } from '@/services/learning-service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validateRequest } from '@/utils/validation';

const learningService = new LearningService();

const GoalValidationRules = [
  { field: 'title', required: true, type: 'string' as const, minLength: 1, maxLength: 200 },
  { field: 'description', required: false, type: 'string' as const, maxLength: 1000 },
  { field: 'targetValue', required: true, type: 'number' as const, min: 0 },
  { field: 'targetDate', required: false, type: 'string' as const },
  { field: 'category', required: false, type: 'string' as const },
  { field: 'priority', required: false, type: 'string' as const, enum: ['low', 'medium', 'high'] },
  { field: 'isPublic', required: false, type: 'boolean' as const }
];

// GET /api/learning/progress/goals?userId=xxx&status=active&limit=10
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    const status = searchParams.get('status'); // active, completed, paused, expired
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
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
          message: 'You can only access your own goals' 
        },
        { status: 403 }
      );
    }
    
    const goals = await learningService.getGoals(userId, {
      status,
      category,
      limit: Math.min(limit, 100),
      offset: Math.max(offset, 0)
    });
    
    return NextResponse.json({
      success: true,
      data: goals,
      pagination: {
        limit,
        offset,
        total: goals.length,
        hasMore: goals.length === limit
      },
      message: 'Goals retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch goals',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// POST /api/learning/progress/goals - Create new goal
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(body, GoalValidationRules);
    if (!validation.isValid) {
      return validation.response!;
    }
    
    const { userId, ...goalData } = validation.validatedData;
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
          message: 'You can only create your own goals' 
        },
        { status: 403 }
      );
    }
    
    const goal = await learningService.createGoal(targetUserId, {
      ...goalData,
      createdAt: new Date(),
      status: 'active'
    });
    
    return NextResponse.json({
      success: true,
      data: goal,
      message: 'Goal created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create goal',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// PUT /api/learning/progress/goals/:id - Update goal
export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get('id');
    
    if (!goalId) {
      return NextResponse.json(
        { 
          error: 'Goal ID is required',
          message: 'Please provide a valid goal ID' 
        },
        { status: 400 }
      );
    }
    
    // Validate request body
    const validation = validateRequest(body, GoalValidationRules);
    if (!validation.isValid) {
      return validation.response!;
    }
    
    // Check if user can update this goal
    const canUpdate = await learningService.canUpdateGoal(goalId, request.user?.id);
    if (!canUpdate && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only update your own goals' 
        },
        { status: 403 }
      );
    }
    
    const updatedGoal = await learningService.updateGoal(goalId, {
      ...validation.validatedData,
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      data: updatedGoal,
      message: 'Goal updated successfully'
    });
  } catch (error) {
    console.error('Error updating goal:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update goal',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// PATCH /api/learning/progress/goals/:id/status - Update goal status
export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get('id');
    const { status, reason } = body;
    
    if (!goalId) {
      return NextResponse.json(
        { 
          error: 'Goal ID is required',
          message: 'Please provide a valid goal ID' 
        },
        { status: 400 }
      );
    }
    
    if (!status || !['active', 'completed', 'paused', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { 
          error: 'Invalid status',
          message: 'Status must be one of: active, completed, paused, cancelled' 
        },
        { status: 400 }
      );
    }
    
    // Check if user can update this goal
    const canUpdate = await learningService.canUpdateGoal(goalId, request.user?.id);
    if (!canUpdate && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only update your own goals' 
        },
        { status: 403 }
      );
    }
    
    const updatedGoal = await learningService.updateGoalStatus(goalId, status, {
      reason,
      updatedBy: request.user?.id,
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      data: updatedGoal,
      message: `Goal status updated to ${status} successfully`
    });
  } catch (error) {
    console.error('Error updating goal status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update goal status',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// DELETE /api/learning/progress/goals/:id - Delete goal
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get('id');
    
    if (!goalId) {
      return NextResponse.json(
        { 
          error: 'Goal ID is required',
          message: 'Please provide a valid goal ID' 
        },
        { status: 400 }
      );
    }
    
    // Check if user can delete this goal
    const canDelete = await learningService.canDeleteGoal(goalId, request.user?.id);
    if (!canDelete && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only delete your own goals' 
        },
        { status: 403 }
      );
    }
    
    await learningService.deleteGoal(goalId);
    
    return NextResponse.json({
      success: true,
      message: 'Goal deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete goal',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});