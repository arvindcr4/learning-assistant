// Enhanced content adaptation API routes
import { NextRequest, NextResponse } from 'next/server';
import { LearningService } from '@/services/learning-service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validateRequest, ContentValidationRules } from '@/utils/validation';
import { AdaptiveContent } from '@/types';

const learningService = new LearningService();

// GET /api/learning/content/adapt?contentId=xxx&userId=xxx&includeVariants=true
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('contentId');
    const userId = searchParams.get('userId') || request.user?.id;
    const includeVariants = searchParams.get('includeVariants') === 'true';
    const adaptationType = searchParams.get('adaptationType'); // 'style', 'difficulty', 'pace', 'all'
    
    if (!contentId || !userId) {
      return NextResponse.json(
        { 
          error: 'Content ID and User ID are required',
          message: 'Please provide valid content ID and user ID' 
        },
        { status: 400 }
      );
    }
    
    // Check authorization
    if (request.user?.id !== userId && request.user?.role !== 'admin' && request.user?.role !== 'educator') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only adapt content for yourself' 
        },
        { status: 403 }
      );
    }
    
    // Get the base content
    const baseContent = await learningService.getContent(contentId);
    if (!baseContent) {
      return NextResponse.json(
        { 
          error: 'Content not found',
          message: 'The specified content does not exist' 
        },
        { status: 404 }
      );
    }
    
    // Adapt content for the user
    const adaptedContent = await learningService.adaptContentForUser(baseContent, userId);
    
    // Get additional adaptation data if requested
    let adaptationData: any = {};
    if (includeVariants) {
      adaptationData.availableVariants = baseContent.contentVariants;
      adaptationData.adaptationHistory = await learningService.getAdaptationHistory(contentId, userId);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        originalContent: baseContent,
        adaptedContent,
        reasoning: adaptedContent.reasoning,
        ...adaptationData
      },
      message: 'Content adapted successfully'
    });
  } catch (error) {
    console.error('Error adapting content:', error);
    return NextResponse.json(
      { 
        error: 'Failed to adapt content',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// POST /api/learning/content/adapt - Create adaptive content
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(body, ContentValidationRules.adapt);
    if (!validation.isValid) {
      return validation.response!;
    }
    
    const { userId, content } = validation.validatedData;
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
    
    // Only educators and admins can create adaptive content
    if (request.user?.role !== 'admin' && request.user?.role !== 'educator') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Only educators and admins can create adaptive content' 
        },
        { status: 403 }
      );
    }
    
    // Validate and enhance content structure
    const adaptiveContent: AdaptiveContent = {
      id: content.id || crypto.randomUUID(),
      title: content.title,
      description: content.description,
      concept: content.concept,
      learningObjectives: content.learningObjectives || [],
      difficulty: content.difficulty || 5,
      estimatedDuration: content.estimatedDuration || 30,
      contentVariants: content.contentVariants || [],
      assessments: content.assessments || [],
      prerequisites: content.prerequisites || [],
      metadata: {
        tags: content.metadata?.tags || [],
        language: content.metadata?.language || 'en',
        difficulty: content.difficulty || 5,
        bloomsTaxonomyLevel: content.metadata?.bloomsTaxonomyLevel || 'remember',
        cognitiveLoad: content.metadata?.cognitiveLoad || 5,
        estimatedEngagement: content.metadata?.estimatedEngagement || 5,
        successRate: content.metadata?.successRate || 80,
        ...content.metadata
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const createdContent = await learningService.createAdaptiveContent(adaptiveContent, request.user.id);
    
    return NextResponse.json({
      success: true,
      data: createdContent,
      message: 'Adaptive content created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating adaptive content:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create adaptive content',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// PUT /api/learning/content/adapt/:id - Update adaptive content
export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('id');
    
    if (!contentId) {
      return NextResponse.json(
        { 
          error: 'Content ID is required',
          message: 'Please provide a valid content ID' 
        },
        { status: 400 }
      );
    }
    
    // Check if user can update this content
    const canUpdate = await learningService.canUpdateContent(contentId, request.user?.id);
    if (!canUpdate && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only update your own content' 
        },
        { status: 403 }
      );
    }
    
    const updatedContent = await learningService.updateAdaptiveContent(contentId, {
      ...body,
      updatedAt: new Date(),
      updatedBy: request.user.id
    });
    
    return NextResponse.json({
      success: true,
      data: updatedContent,
      message: 'Adaptive content updated successfully'
    });
  } catch (error) {
    console.error('Error updating adaptive content:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update adaptive content',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// PATCH /api/learning/content/adapt/feedback - Provide adaptation feedback
export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { contentId, userId, feedback, rating, adaptationEffectiveness } = body;
    
    const targetUserId = userId || request.user?.id;
    
    if (!contentId || !targetUserId || !feedback) {
      return NextResponse.json(
        { 
          error: 'Content ID, User ID, and feedback are required',
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
          message: 'You can only provide feedback for your own adaptations' 
        },
        { status: 403 }
      );
    }
    
    const feedbackResult = await learningService.provideAdaptationFeedback(contentId, targetUserId, {
      feedback,
      rating: Math.min(Math.max(rating || 5, 1), 10), // Ensure rating is between 1-10
      adaptationEffectiveness: Math.min(Math.max(adaptationEffectiveness || 5, 1), 10),
      providedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      data: feedbackResult,
      message: 'Adaptation feedback recorded successfully'
    });
  } catch (error) {
    console.error('Error recording adaptation feedback:', error);
    return NextResponse.json(
      { 
        error: 'Failed to record adaptation feedback',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// DELETE /api/learning/content/adapt/:id - Delete adaptive content
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('id');
    
    if (!contentId) {
      return NextResponse.json(
        { 
          error: 'Content ID is required',
          message: 'Please provide a valid content ID' 
        },
        { status: 400 }
      );
    }
    
    // Check if user can delete this content
    const canDelete = await learningService.canDeleteContent(contentId, request.user?.id);
    if (!canDelete && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only delete your own content' 
        },
        { status: 403 }
      );
    }
    
    await learningService.deleteAdaptiveContent(contentId);
    
    return NextResponse.json({
      success: true,
      message: 'Adaptive content deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting adaptive content:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete adaptive content',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});