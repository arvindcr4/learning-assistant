import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '../../../../services/ai-service';
import { promptService } from '../../../../services/prompt-service';
import { conversationService } from '../../../../services/conversation-service';
import { v4 as uuidv4 } from 'uuid';
import { 
  TutoringSession, 
  TutoringQuestion, 
  TutoringResponse, 
  LearningContext,
  ChatMessage 
} from '../../../../types';

// In-memory storage for tutoring sessions (in production, use a database)
const tutoringSessions = new Map<string, TutoringSession>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      action, 
      sessionId, 
      userId, 
      learningContext,
      topic,
      objectives,
      questionResponse 
    } = body;

    switch (action) {
      case 'start_session':
        return await startTutoringSession(userId, learningContext, topic, objectives);
      
      case 'generate_question':
        return await generateTutoringQuestion(sessionId, learningContext);
      
      case 'submit_answer':
        return await submitAnswer(sessionId, questionResponse, learningContext);
      
      case 'get_hint':
        return await getHint(sessionId, learningContext);
      
      case 'explain_concept':
        return await explainConcept(sessionId, questionResponse.concept, learningContext);
      
      case 'complete_session':
        return await completeTutoringSession(sessionId);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Tutoring API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process tutoring request' },
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
      const session = tutoringSessions.get(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: 'Tutoring session not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        session
      });
    }

    if (userId) {
      const userSessions = Array.from(tutoringSessions.values())
        .filter(session => session.userId === userId)
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

      return NextResponse.json({
        success: true,
        sessions: userSessions
      });
    }

    return NextResponse.json(
      { error: 'Missing sessionId or userId parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Tutoring GET API Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve tutoring data' },
      { status: 500 }
    );
  }
}

async function startTutoringSession(
  userId: string,
  learningContext: LearningContext,
  topic?: string,
  objectives?: string[]
): Promise<NextResponse> {
  const session: TutoringSession = {
    id: uuidv4(),
    chatSessionId: uuidv4(),
    userId,
    subject: learningContext.currentPath || 'General Learning',
    topic: topic || learningContext.currentModule || 'Current Topic',
    objectives: objectives || [
      'Understand key concepts',
      'Apply knowledge through practice',
      'Demonstrate mastery through assessment'
    ],
    startTime: new Date(),
    duration: 0,
    progress: {
      conceptsIntroduced: [],
      conceptsUnderstood: [],
      conceptsNeedsWork: [],
      questionsAsked: 0,
      questionsAnswered: 0,
      correctAnswers: 0,
      hintsProvided: 0,
      explanationsGiven: 0,
      currentUnderstanding: 0
    },
    assessments: [],
    adaptiveActions: [],
    outcome: {
      conceptsMastered: [],
      conceptsToReview: [],
      recommendedNextSteps: [],
      overallScore: 0,
      engagement: 0,
      satisfaction: 0,
      timeToMastery: 0
    },
    feedback: {
      positive: [],
      constructive: [],
      encouragement: '',
      nextSession: '',
      resources: []
    }
  };

  tutoringSessions.set(session.id, session);

  // Generate introduction
  const introResponse = await aiService.generateExplanation(
    session.topic,
    learningContext,
    'detailed'
  );

  // Update progress
  session.progress.conceptsIntroduced.push(session.topic);
  session.progress.explanationsGiven++;

  return NextResponse.json({
    success: true,
    session,
    introduction: introResponse.content,
    suggestions: introResponse.suggestions
  });
}

async function generateTutoringQuestion(
  sessionId: string,
  learningContext: LearningContext
): Promise<NextResponse> {
  const session = tutoringSessions.get(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Tutoring session not found' },
      { status: 404 }
    );
  }

  // Generate question using AI service
  const questionResponse = await aiService.generateAssessmentQuestion(
    session.topic,
    learningContext.difficultyLevel || 'intermediate',
    learningContext
  );

  // Parse response to create structured question
  const question: TutoringQuestion = {
    id: uuidv4(),
    text: questionResponse.content,
    type: 'short-answer',
    difficulty: getDifficultyNumber(learningContext.difficultyLevel),
    concept: session.topic,
    hints: questionResponse.suggestions || []
  };

  // Update session progress
  session.progress.questionsAsked++;
  session.duration = Math.floor((new Date().getTime() - session.startTime.getTime()) / 1000 / 60);

  return NextResponse.json({
    success: true,
    question,
    session
  });
}

async function submitAnswer(
  sessionId: string,
  questionResponse: any,
  learningContext: LearningContext
): Promise<NextResponse> {
  const session = tutoringSessions.get(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Tutoring session not found' },
      { status: 404 }
    );
  }

  const { questionId, answer, timeSpent } = questionResponse;

  // Use AI to assess the answer
  const assessmentPrompt = promptService.generateContextualPrompt(
    'assessment',
    learningContext,
    {
      question: questionResponse.question,
      answer: answer,
      concept: session.topic
    }
  );

  const assessmentResponse = await aiService.generateResponse(
    assessmentPrompt,
    learningContext
  );

  // Determine correctness (simplified - in production, use more sophisticated assessment)
  const isCorrect = assessmentResponse.content.toLowerCase().includes('correct') && 
                   !assessmentResponse.content.toLowerCase().includes('incorrect');
  
  const tutoringResponse: TutoringResponse = {
    questionId,
    userAnswer: answer,
    isCorrect,
    confidence: 85, // Would be extracted from AI response
    timeSpent: timeSpent || 60,
    hintsUsed: 0, // Would track from session
    reasoning: answer,
    feedback: assessmentResponse.content
  };

  // Update session progress
  session.progress.questionsAnswered++;
  
  if (isCorrect) {
    session.progress.correctAnswers++;
    if (!session.progress.conceptsUnderstood.includes(session.topic)) {
      session.progress.conceptsUnderstood.push(session.topic);
    }
  } else {
    if (!session.progress.conceptsNeedsWork.includes(session.topic)) {
      session.progress.conceptsNeedsWork.push(session.topic);
    }
  }

  // Calculate current understanding
  session.progress.currentUnderstanding = 
    (session.progress.correctAnswers / session.progress.questionsAnswered) * 100;

  session.duration = Math.floor((new Date().getTime() - session.startTime.getTime()) / 1000 / 60);

  return NextResponse.json({
    success: true,
    response: tutoringResponse,
    session,
    isCorrect,
    needsAdditionalHelp: !isCorrect
  });
}

async function getHint(
  sessionId: string,
  learningContext: LearningContext
): Promise<NextResponse> {
  const session = tutoringSessions.get(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Tutoring session not found' },
      { status: 404 }
    );
  }

  // Generate hint
  const hintResponse = await aiService.generateHint(
    `Understanding ${session.topic}`,
    learningContext,
    'moderate'
  );

  // Update session progress
  session.progress.hintsProvided++;

  return NextResponse.json({
    success: true,
    hint: hintResponse.content,
    session
  });
}

async function explainConcept(
  sessionId: string,
  concept: string,
  learningContext: LearningContext
): Promise<NextResponse> {
  const session = tutoringSessions.get(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Tutoring session not found' },
      { status: 404 }
    );
  }

  // Generate detailed explanation
  const explanationResponse = await aiService.generateExplanation(
    concept,
    learningContext,
    'comprehensive'
  );

  // Update session progress
  session.progress.explanationsGiven++;

  return NextResponse.json({
    success: true,
    explanation: explanationResponse.content,
    suggestions: explanationResponse.suggestions,
    session
  });
}

async function completeTutoringSession(sessionId: string): Promise<NextResponse> {
  const session = tutoringSessions.get(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Tutoring session not found' },
      { status: 404 }
    );
  }

  // Finalize session
  session.endTime = new Date();
  session.duration = Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000 / 60);

  // Generate final outcome
  session.outcome = {
    conceptsMastered: session.progress.conceptsUnderstood,
    conceptsToReview: session.progress.conceptsNeedsWork,
    recommendedNextSteps: [
      'Continue practicing with challenging concepts',
      'Review missed topics',
      'Move to next module when ready'
    ],
    overallScore: session.progress.currentUnderstanding,
    engagement: calculateEngagement(session),
    satisfaction: 90, // Would be collected from user feedback
    timeToMastery: session.duration
  };

  // Generate final feedback
  session.feedback = {
    positive: [
      'Great engagement with the material',
      'Thoughtful responses to questions',
      'Good progress in understanding'
    ],
    constructive: session.progress.conceptsNeedsWork.map(concept => 
      `Continue practicing with ${concept}`
    ),
    encouragement: 'You\'re making excellent progress! Keep up the great work.',
    nextSession: 'Ready for the next topic or module',
    resources: []
  };

  return NextResponse.json({
    success: true,
    session,
    completed: true
  });
}

function getDifficultyNumber(difficulty?: 'beginner' | 'intermediate' | 'advanced'): number {
  switch (difficulty) {
    case 'beginner': return 3;
    case 'intermediate': return 5;
    case 'advanced': return 7;
    default: return 5;
  }
}

function calculateEngagement(session: TutoringSession): number {
  const baseEngagement = 50;
  let engagement = baseEngagement;
  
  // Increase engagement based on participation
  if (session.progress.questionsAnswered > 0) {
    engagement += 20;
  }
  
  if (session.progress.questionsAnswered >= 3) {
    engagement += 20;
  }
  
  if (session.duration >= 10) {
    engagement += 10;
  }
  
  return Math.min(100, engagement);
}