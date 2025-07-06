import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '../../../services/ai-service';
import { conversationService } from '../../../services/conversation-service';
import { promptService } from '../../../services/prompt-service';
import { v4 as uuidv4 } from 'uuid';
import { 
  ChatMessage, 
  LearningContext, 
  AIResponse,
  ChatSession 
} from '../../../types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      message, 
      sessionId, 
      userId, 
      learningContext, 
      streamResponse = false,
      persona,
      generateResponse = true 
    } = body;

    // Validate required fields
    if (!message || !userId || !learningContext) {
      return NextResponse.json(
        { error: 'Missing required fields: message, userId, or learningContext' },
        { status: 400 }
      );
    }

    // Get or create session
    let session: ChatSession;
    if (sessionId) {
      session = conversationService.getSession(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
    } else {
      session = conversationService.createSession(userId, learningContext);
    }

    // Create user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      content: message,
      role: 'user',
      timestamp: new Date(),
      context: learningContext
    };

    // Add user message to session
    conversationService.addMessage(session.id, userMessage);

    if (!generateResponse) {
      return NextResponse.json({
        success: true,
        sessionId: session.id,
        message: userMessage
      });
    }

    // Get conversation context
    const recentMessages = conversationService.getRecentMessages(session.id, 10);
    const conversationState = conversationService.getConversationState(session.id);

    // Generate AI response
    let aiResponse: AIResponse;
    
    if (streamResponse) {
      // For streaming, we'll need to implement Server-Sent Events
      // For now, return a regular response
      aiResponse = await aiService.generateResponse(
        message,
        learningContext,
        recentMessages,
        persona || session.settings.aiPersona
      );
    } else {
      aiResponse = await aiService.generateResponse(
        message,
        learningContext,
        recentMessages,
        persona || session.settings.aiPersona
      );
    }

    // Create assistant message
    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      content: aiResponse.content,
      role: 'assistant',
      timestamp: new Date(),
      context: learningContext,
      metadata: {
        confidence: aiResponse.confidence,
        sources: aiResponse.sources,
        suggestions: aiResponse.suggestions,
        followUpQuestions: aiResponse.followUpQuestions,
        tutorialPrompts: aiResponse.tutorialPrompts,
        assessmentTrigger: aiResponse.assessmentTrigger
      },
      tokens: aiResponse.metadata.tokens
    };

    // Add assistant message to session
    conversationService.addMessage(session.id, assistantMessage);

    // Update learning context if needed
    if (aiResponse.adaptiveActions.length > 0) {
      // Process adaptive actions
      processAdaptiveActions(session.id, aiResponse.adaptiveActions, learningContext);
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      message: assistantMessage,
      aiResponse,
      conversationState: conversationService.getConversationState(session.id)
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');

    if (sessionId) {
      // Get specific session
      const session = conversationService.getSession(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        session,
        conversationState: conversationService.getConversationState(sessionId)
      });
    }

    if (userId) {
      // Get all sessions for user
      const sessions = conversationService.getUserSessions(userId);
      return NextResponse.json({
        success: true,
        sessions
      });
    }

    return NextResponse.json(
      { error: 'Missing sessionId or userId parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Chat GET API Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve chat data' },
      { status: 500 }
    );
  }
}

function processAdaptiveActions(
  sessionId: string, 
  adaptiveActions: any[], 
  learningContext: LearningContext
) {
  adaptiveActions.forEach(action => {
    switch (action.type) {
      case 'difficulty_adjustment':
        if (action.action === 'increase_difficulty') {
          // Update context to increase difficulty
          conversationService.updateLearningContext(sessionId, {
            difficultyLevel: learningContext.difficultyLevel === 'beginner' ? 'intermediate' : 'advanced'
          });
        } else if (action.action === 'decrease_difficulty') {
          conversationService.updateLearningContext(sessionId, {
            difficultyLevel: learningContext.difficultyLevel === 'advanced' ? 'intermediate' : 'beginner'
          });
        }
        break;
        
      case 'explanation_style':
        // Could update persona or communication style
        break;
        
      case 'encouragement':
        // Could trigger encouragement message
        break;
        
      case 'assessment_trigger':
        // Could trigger assessment mode
        break;
    }
  });
}