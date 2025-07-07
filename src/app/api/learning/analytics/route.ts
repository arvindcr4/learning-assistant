// Enhanced learning analytics API routes
import { NextRequest, NextResponse } from 'next/server';
import { generateUUID } from '@/utils/uuid';
import { LearningService } from '@/services/learning-service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validateRequest, AnalyticsValidationRules } from '@/utils/validation';

const learningService = new LearningService();

// GET /api/learning/analytics?userId=xxx&timeRange=30&metrics=performance,engagement
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    const timeRange = parseInt(searchParams.get('timeRange') || '30');
    const metrics = searchParams.get('metrics')?.split(',') || ['all'];
    const granularity = searchParams.get('granularity') || 'daily'; // daily, weekly, monthly
    const includeComparisons = searchParams.get('includeComparisons') === 'true';
    const includePredictions = searchParams.get('includePredictions') === 'true';
    
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
          message: 'You can only access your own analytics data' 
        },
        { status: 403 }
      );
    }
    
    const analytics = await learningService.generateComprehensiveAnalytics(userId, {
      timeRange: Math.min(timeRange, 365), // Max 1 year
      metrics,
      granularity,
      includeComparisons,
      includePredictions
    });
    
    return NextResponse.json({
      success: true,
      data: analytics,
      metadata: {
        generatedAt: new Date(),
        timeRange,
        granularity,
        metricsIncluded: metrics
      },
      message: 'Analytics data retrieved successfully'
    });
  } catch (error) {
    console.error('Error generating analytics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate analytics',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// POST /api/learning/analytics/track - Track user interaction
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(body, AnalyticsValidationRules.track);
    if (!validation.isValid) {
      return validation.response!;
    }
    
    const { userId, interaction } = validation.validatedData;
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
          message: 'You can only track your own interactions' 
        },
        { status: 403 }
      );
    }
    
    const trackingResult = await learningService.trackUserInteraction(targetUserId, {
      ...interaction,
      timestamp: new Date(),
      sessionId: interaction.sessionId || generateUUID(),
      ip: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });
    
    return NextResponse.json({
      success: true,
      data: trackingResult,
      message: 'User interaction tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking user interaction:', error);
    return NextResponse.json(
      { 
        error: 'Failed to track user interaction',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// GET /api/learning/analytics/insights?userId=xxx&type=learning_patterns
export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    const insightType = searchParams.get('type') || 'all'; // learning_patterns, performance_trends, recommendations
    const timeRange = parseInt(searchParams.get('timeRange') || '30');
    
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
          message: 'You can only access your own insights' 
        },
        { status: 403 }
      );
    }
    
    const insights = await learningService.generateLearningInsights(userId, {
      type: insightType,
      timeRange: Math.min(timeRange, 365)
    });
    
    return NextResponse.json({
      success: true,
      data: insights,
      message: 'Learning insights generated successfully'
    });
  } catch (error) {
    console.error('Error generating learning insights:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate learning insights',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// POST /api/learning/analytics/export - Export analytics data
export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { userId, format = 'json', includeRawData = false, timeRange = 30 } = body;
    
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
          message: 'You can only export your own analytics data' 
        },
        { status: 403 }
      );
    }
    
    if (!['json', 'csv', 'xlsx'].includes(format)) {
      return NextResponse.json(
        { 
          error: 'Invalid format',
          message: 'Format must be one of: json, csv, xlsx' 
        },
        { status: 400 }
      );
    }
    
    const exportData = await learningService.exportAnalyticsData(targetUserId, {
      format,
      includeRawData,
      timeRange: Math.min(timeRange, 365),
      exportedBy: request.user.id,
      exportedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      data: exportData,
      message: 'Analytics data exported successfully'
    });
  } catch (error) {
    console.error('Error exporting analytics data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to export analytics data',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});

// DELETE /api/learning/analytics - Delete analytics data
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || request.user?.id;
    const dataType = searchParams.get('dataType') || 'interactions'; // interactions, sessions, all
    const beforeDate = searchParams.get('beforeDate');
    
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
          message: 'You can only delete your own analytics data' 
        },
        { status: 403 }
      );
    }
    
    const deletionResult = await learningService.deleteAnalyticsData(userId, {
      dataType,
      beforeDate: beforeDate ? new Date(beforeDate) : undefined,
      deletedBy: request.user.id,
      deletedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      data: deletionResult,
      message: `Analytics data (${dataType}) deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting analytics data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete analytics data',
        message: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
});