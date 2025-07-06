import { NextRequest, NextResponse } from 'next/server';
import { conversationService } from '../../../../services/conversation-service';
import { ChatSession, LearningContext } from '../../../../types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, learningContext, title, description } = body;

    if (!userId || !learningContext) {
      return NextResponse.json(
        { error: 'Missing required fields: userId or learningContext' },
        { status: 400 }
      );
    }

    // Create new session
    const session = conversationService.createSession(userId, learningContext);
    
    // Update title and description if provided
    if (title || description) {
      conversationService.updateSession(session.id, {
        title: title || session.title,
        description: description || session.description
      });
    }

    return NextResponse.json({
      success: true,
      session
    });

  } catch (error) {
    console.error('Create Session API Error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get user sessions
    let sessions = conversationService.getUserSessions(userId);

    // Filter by status if provided
    if (status && status !== 'all') {
      sessions = sessions.filter(session => session.status === status);
    }

    // Limit results if provided
    if (limit) {
      const limitNum = parseInt(limit);
      sessions = sessions.slice(0, limitNum);
    }

    return NextResponse.json({
      success: true,
      sessions,
      total: sessions.length
    });

  } catch (error) {
    console.error('Get Sessions API Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve sessions' },
      { status: 500 }
    );
  }
}