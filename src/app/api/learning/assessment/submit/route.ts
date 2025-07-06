// Assessment submission API routes
import { NextRequest, NextResponse } from 'next/server';
import { LearningService } from '@/services/learning-service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validateRequest, AssessmentValidationRules } from '@/utils/validation';

const learningService = new LearningService();

// POST /api/learning/assessment/submit - Submit assessment answers
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(body, AssessmentValidationRules.submit);
    if (!validation.isValid) {
      return validation.response!;
    }
    
    const { userId, assessmentId, answers, timeSpent } = validation.validatedData;
    
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
    
    // Check if user can submit this assessment
    if (request.user?.id !== targetUserId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only submit your own assessments' 
        },
        { status: 403 }
      );
    }
    
    // Check if assessment exists and is active
    const assessment = await learningService.getAssessment(assessmentId);
    if (!assessment) {
      return NextResponse.json(
        { 
          error: 'Assessment not found',
          message: 'The specified assessment does not exist' 
        },
        { status: 404 }
      );
    }
    
    // Check if user has already submitted this assessment
    const existingSubmission = await learningService.getAssessmentSubmission(assessmentId, targetUserId);
    if (existingSubmission) {
      return NextResponse.json(
        { 
          error: 'Assessment already submitted',
          message: 'You have already submitted this assessment' 
        },
        { status: 409 }
      );
    }
    
    // Process the submission
    const result = await learningService.submitAssessment({
      userId: targetUserId,
      assessmentId,
      answers,
      timeSpent: timeSpent || 0,
      submittedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Assessment submitted successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    return NextResponse.json(
      { 
        error: 'Failed to submit assessment',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// GET /api/learning/assessment/submit?userId=xxx&assessmentId=xxx - Get submission status
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    const assessmentId = searchParams.get('assessmentId');
    
    if (!userId || !assessmentId) {
      return NextResponse.json(
        { 
          error: 'User ID and Assessment ID are required',
          message: 'Please provide valid user ID and assessment ID' 
        },
        { status: 400 }
      );
    }
    
    // Check authorization
    if (request.user?.id !== userId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only access your own submission status' 
        },
        { status: 403 }
      );
    }
    
    const submission = await learningService.getAssessmentSubmission(assessmentId, userId);
    
    if (!submission) {
      return NextResponse.json({
        success: true,
        data: {
          submitted: false,
          canSubmit: true,
          message: 'Assessment not yet submitted'
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        submitted: true,
        canSubmit: false,
        submission: submission,
        message: 'Assessment already submitted'
      }
    });
  } catch (error) {
    console.error('Error checking submission status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check submission status',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// PUT /api/learning/assessment/submit - Update submission (if allowed)
export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(body, AssessmentValidationRules.submit);
    if (!validation.isValid) {
      return validation.response!;
    }
    
    const { userId, assessmentId, answers, timeSpent } = validation.validatedData;
    
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
    
    // Check if user can update this submission
    if (request.user?.id !== targetUserId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only update your own submissions' 
        },
        { status: 403 }
      );
    }
    
    // Check if assessment allows resubmission
    const assessment = await learningService.getAssessment(assessmentId);
    if (!assessment?.allowResubmission) {
      return NextResponse.json(
        { 
          error: 'Resubmission not allowed',
          message: 'This assessment does not allow resubmission' 
        },
        { status: 403 }
      );
    }
    
    // Update the submission
    const result = await learningService.updateAssessmentSubmission(assessmentId, targetUserId, {
      answers,
      timeSpent: timeSpent || 0,
      resubmittedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Assessment submission updated successfully'
    });
  } catch (error) {
    console.error('Error updating assessment submission:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update assessment submission',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// DELETE /api/learning/assessment/submit - Withdraw submission (if allowed)
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    const assessmentId = searchParams.get('assessmentId');
    
    if (!userId || !assessmentId) {
      return NextResponse.json(
        { 
          error: 'User ID and Assessment ID are required',
          message: 'Please provide valid user ID and assessment ID' 
        },
        { status: 400 }
      );
    }
    
    // Check authorization
    if (request.user?.id !== userId && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only withdraw your own submissions' 
        },
        { status: 403 }
      );
    }
    
    // Check if assessment allows withdrawal
    const assessment = await learningService.getAssessment(assessmentId);
    if (!assessment?.allowWithdrawal) {
      return NextResponse.json(
        { 
          error: 'Withdrawal not allowed',
          message: 'This assessment does not allow withdrawal' 
        },
        { status: 403 }
      );
    }
    
    // Delete the submission
    await learningService.deleteAssessmentSubmission(assessmentId, userId);
    
    return NextResponse.json({
      success: true,
      message: 'Assessment submission withdrawn successfully'
    });
  } catch (error) {
    console.error('Error withdrawing assessment submission:', error);
    return NextResponse.json(
      { 
        error: 'Failed to withdraw assessment submission',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});