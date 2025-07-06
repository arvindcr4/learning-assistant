// Enhanced learning session management API routes
import { NextRequest, NextResponse } from 'next/server';
import { LearningService } from '@/services/learning-service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validateRequest, SessionValidationRules } from '@/utils/validation';
import { LearningSession } from '@/types';

const learningService = new LearningService();

// GET /api/learning/session?userId=xxx&limit=10&offset=0&status=active
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status'); // active, completed, paused
    const contentId = searchParams.get('contentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
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
          message: 'You can only access your own learning sessions' 
        },
        { status: 403 }
      );
    }
    
    const sessions = await learningService.getLearningSessions(userId, {
      limit: Math.min(limit, 100),
      offset: Math.max(offset, 0),
      status,
      contentId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
    
    return NextResponse.json({
      success: true,
      data: sessions,
      pagination: {
        limit,
        offset,
        total: sessions.length,
        hasMore: sessions.length === limit
      },
      message: 'Learning sessions retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching learning sessions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch learning sessions',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// POST /api/learning/session - Create/Start new learning session
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(body, SessionValidationRules.create);
    if (!validation.isValid) {
      return validation.response!;
    }
    
    const { userId, sessionData } = validation.validatedData;
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
          message: 'You can only create your own learning sessions' 
        },
        { status: 403 }
      );
    }
    
    // Check if user has any active sessions for this content
    const activeSessions = await learningService.getActiveSession(targetUserId, sessionData.contentId);
    if (activeSessions.length > 0) {
      return NextResponse.json(
        { 
          error: 'Active session exists',
          message: 'You already have an active session for this content',
          data: { activeSession: activeSessions[0] }
        },
        { status: 409 }
      );
    }
    
    // Create validated session
    const validatedSession: LearningSession = {
      id: sessionData.id || crypto.randomUUID(),
      userId: targetUserId,
      contentId: sessionData.contentId,
      startTime: new Date(sessionData.startTime),
      endTime: sessionData.endTime ? new Date(sessionData.endTime) : undefined,
      duration: sessionData.duration || 0,
      itemsCompleted: sessionData.itemsCompleted || 0,
      correctAnswers: sessionData.correctAnswers || 0,
      totalQuestions: sessionData.totalQuestions || 0,
      engagementMetrics: sessionData.engagementMetrics || {
        focusTime: 0,
        distractionEvents: 0,
        interactionRate: 0,
        scrollDepth: 0,
        videoWatchTime: 0,
        pauseFrequency: 0
      },
      adaptiveChanges: sessionData.adaptiveChanges || [],
      completed: sessionData.completed || false
    };
    
    const result = await learningService.createLearningSession(validatedSession);
    
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Learning session created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating learning session:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create learning session',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// PUT /api/learning/session/:id - Update learning session
export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');
    
    if (!sessionId) {
      return NextResponse.json(
        { 
          error: 'Session ID is required',
          message: 'Please provide a valid session ID' 
        },
        { status: 400 }
      );
    }
    
    // Check if user can update this session
    const canUpdate = await learningService.canUpdateSession(sessionId, request.user?.id);
    if (!canUpdate && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only update your own learning sessions' 
        },
        { status: 403 }
      );
    }
    
    const updatedSession = await learningService.updateLearningSession(sessionId, body);
    
    return NextResponse.json({
      success: true,
      data: updatedSession,
      message: 'Learning session updated successfully'
    });
  } catch (error) {
    console.error('Error updating learning session:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update learning session',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// PATCH /api/learning/session/:id/complete - Complete learning session
export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');
    
    if (!sessionId) {
      return NextResponse.json(
        { 
          error: 'Session ID is required',
          message: 'Please provide a valid session ID' 
        },
        { status: 400 }
      );
    }
    
    // Check if user can complete this session
    const canUpdate = await learningService.canUpdateSession(sessionId, request.user?.id);
    if (!canUpdate && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only complete your own learning sessions' 
        },
        { status: 403 }
      );
    }
    
    const completedSession = await learningService.completeLearningSession(sessionId, {
      endTime: new Date(),
      finalMetrics: body.finalMetrics,
      sessionNotes: body.sessionNotes
    });
    
    // Process the completed session for analytics and adaptations
    const result = await learningService.processLearningSession(completedSession, completedSession.userId);
    
    return NextResponse.json({
      success: true,
      data: {
        session: completedSession,
        adaptations: result.paceAdjustments,
        recommendations: result.recommendations
      },
      message: 'Learning session completed successfully'
    });
  } catch (error) {
    console.error('Error completing learning session:', error);
    return NextResponse.json(
      { 
        error: 'Failed to complete learning session',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// DELETE /api/learning/session/:id - Delete learning session
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');
    
    if (!sessionId) {
      return NextResponse.json(
        { 
          error: 'Session ID is required',
          message: 'Please provide a valid session ID' 
        },
        { status: 400 }
      );
    }
    
    // Check if user can delete this session
    const canDelete = await learningService.canDeleteSession(sessionId, request.user?.id);
    if (!canDelete && request.user?.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'You can only delete your own learning sessions' 
        },
        { status: 403 }
      );
    }
    
    await learningService.deleteLearningSession(sessionId);
    
    return NextResponse.json({
      success: true,
      message: 'Learning session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting learning session:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete learning session',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});