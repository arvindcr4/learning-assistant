// Comprehensive API routes for assessment management
import { NextRequest, NextResponse } from 'next/server';
import { LearningService } from '@/services/learning-service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validateRequest, AssessmentValidationRules } from '@/utils/validation';

const learningService = new LearningService();

// GET /api/learning/assessment?userId=xxx&type=xxx&limit=10&offset=0
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    const type = searchParams.get('type'); // 'formative', 'summative', 'diagnostic'
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status'); // 'active', 'completed', 'expired'
    
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
          message: 'You can only access your own assessments' 
        },
        { status: 403 }
      );
    }
    
    const assessments = await learningService.getAssessments(userId, {
      type,
      limit: Math.min(limit, 100), // Max 100 items per request
      offset: Math.max(offset, 0),
      status
    });
    
    return NextResponse.json({
      success: true,
      data: assessments,
      pagination: {
        limit,
        offset,
        total: assessments.length,
        hasMore: assessments.length === limit
      },
      message: 'Assessments retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching assessments:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch assessments',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// POST /api/learning/assessment - Create new assessment
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(body, AssessmentValidationRules.create);
    if (!validation.isValid) {
      return validation.response!;
    }
    
    const { title, description, questions, timeLimit, passingScore, type = 'formative' } = validation.validatedData;
    
    // Only admins and educators can create assessments
    if (request.user?.role !== 'admin' && request.user?.role !== 'educator') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Only admins and educators can create assessments' 
        },
        { status: 403 }
      );
    }
    
    const assessment = await learningService.createAssessment({
      title,
      description,
      questions,
      timeLimit,
      passingScore: passingScore || 70,
      type,
      createdBy: request.user.id
    });
    
    return NextResponse.json({
      success: true,
      data: assessment,
      message: 'Assessment created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating assessment:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create assessment',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// PUT /api/learning/assessment/:id - Update assessment
export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('id');
    
    if (!assessmentId) {
      return NextResponse.json(
        { 
          error: 'Assessment ID is required',
          message: 'Please provide a valid assessment ID' 
        },
        { status: 400 }
      );
    }
    
    // Validate request body
    const validation = validateRequest(body, AssessmentValidationRules.create);
    if (!validation.isValid) {
      return validation.response!;
    }
    
    // Check if user can update this assessment
    const canUpdate = await learningService.canUpdateAssessment(assessmentId, request.user?.id);
    if (!canUpdate && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only update your own assessments' 
        },
        { status: 403 }
      );
    }
    
    const updatedAssessment = await learningService.updateAssessment(assessmentId, validation.validatedData);
    
    return NextResponse.json({
      success: true,
      data: updatedAssessment,
      message: 'Assessment updated successfully'
    });
  } catch (error) {
    console.error('Error updating assessment:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update assessment',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// DELETE /api/learning/assessment/:id - Delete assessment
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('id');
    
    if (!assessmentId) {
      return NextResponse.json(
        { 
          error: 'Assessment ID is required',
          message: 'Please provide a valid assessment ID' 
        },
        { status: 400 }
      );
    }
    
    // Check if user can delete this assessment
    const canDelete = await learningService.canDeleteAssessment(assessmentId, request.user?.id);
    if (!canDelete && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only delete your own assessments' 
        },
        { status: 403 }
      );
    }
    
    await learningService.deleteAssessment(assessmentId);
    
    return NextResponse.json({
      success: true,
      message: 'Assessment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assessment:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete assessment',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});