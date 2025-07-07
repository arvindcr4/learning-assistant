'use client';

import React, { useState, useEffect } from 'react';
import { GraduationCap, Target, Clock, Award, TrendingUp, CheckCircle, XCircle, HelpCircle, BookOpen, Brain, Lightbulb, MessageSquare } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { 
  TutoringSession, 
  TutoringProgress, 
  TutoringAssessment, 
  TutoringQuestion, 
  TutoringResponse, 
  LearningContext, 
  ChatMessage 
} from '../../../types';
import { aiService } from '../../../services/ai-service';

interface TutoringAssistantProps {
  userId: string;
  learningContext: LearningContext;
  onProgressUpdate: (progress: TutoringProgress) => void;
  onSessionComplete: (session: TutoringSession) => void;
  className?: string;
}

export const TutoringAssistant: React.FC<TutoringAssistantProps> = ({
  userId,
  learningContext,
  onProgressUpdate,
  onSessionComplete,
  className = ''
}) => {
  const [currentSession, setCurrentSession] = useState<TutoringSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<TutoringQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [isAssessing, setIsAssessing] = useState(false);
  const [sessionMode, setSessionMode] = useState<'topic_intro' | 'practice' | 'assessment' | 'review'>('topic_intro');
  const [currentTopic, setCurrentTopic] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Initialize tutoring session
  useEffect(() => {
    if (learningContext.currentModule) {
      initializeTutoringSession();
    }
  }, [learningContext.currentModule]);

  const initializeTutoringSession = async () => {
    const session: TutoringSession = {
      id: uuidv4(),
      chatSessionId: uuidv4(),
      userId,
      subject: learningContext.currentPath || 'General Learning',
      topic: learningContext.currentModule || 'Current Topic',
      objectives: [
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

    setCurrentSession(session);
    setCurrentTopic(session.topic);
    setSessionMode('topic_intro');
    
    // Start with topic introduction
    await introduceTopicWithAI(session.topic);
  };

  const introduceTopicWithAI = async (topic: string) => {
    try {
      const response = await aiService.generateExplanation(
        topic,
        learningContext,
        'detailed'
      );

      const introMessage: ChatMessage = {
        id: uuidv4(),
        content: response.content,
        role: 'assistant',
        timestamp: new Date(),
        context: learningContext,
        metadata: {
          tutorialPrompts: response.tutorialPrompts,
          followUpQuestions: response.followUpQuestions,
          assessmentTrigger: response.assessmentTrigger
        }
      };

      setChatMessages([introMessage]);
      
      // Update session progress
      if (currentSession) {
        updateSessionProgress('conceptsIntroduced', [topic]);
      }
    } catch (error) {
      console.error('Error introducing topic:', error);
    }
  };

  const generatePracticeQuestion = async () => {
    if (!currentSession) return;

    try {
      const response = await aiService.generateAssessmentQuestion(
        currentSession.topic,
        learningContext.difficultyLevel || 'intermediate',
        learningContext
      );

      // Parse the response to create a structured question
      const question: TutoringQuestion = {
        id: uuidv4(),
        text: response.content,
        type: 'short-answer',
        difficulty: learningContext.difficultyLevel === 'beginner' ? 3 : 
                   learningContext.difficultyLevel === 'intermediate' ? 5 : 7,
        concept: currentSession.topic,
        hints: response.suggestions || []
      };

      setCurrentQuestion(question);
      updateSessionProgress('questionsAsked', currentSession.progress.questionsAsked + 1);
      setSessionMode('practice');
    } catch (error) {
      console.error('Error generating practice question:', error);
    }
  };

  const handleAnswerSubmit = async () => {
    if (!currentQuestion || !userAnswer.trim() || !currentSession) return;

    setIsAssessing(true);

    try {
      // Get AI assessment of the answer
      const assessmentPrompt = `
        Question: ${currentQuestion.text}
        Student Answer: ${userAnswer}
        
        Please assess this answer and provide:
        1. Whether it's correct (true/false)
        2. A confidence score (0-100)
        3. Specific feedback
        4. Areas for improvement if incorrect
        5. Encouragement
      `;

      const response = await aiService.generateResponse(assessmentPrompt, learningContext);

      // Parse response to determine correctness (simplified)
      const isCorrect = response.content.toLowerCase().includes('correct') && 
                       !response.content.toLowerCase().includes('incorrect');
      const confidence = 85; // Would be extracted from actual AI response

      const tutoringResponse: TutoringResponse = {
        questionId: currentQuestion.id,
        userAnswer,
        isCorrect,
        confidence,
        timeSpent: 60, // Would track actual time
        hintsUsed: hintLevel,
        reasoning: userAnswer,
        feedback: response.content
      };

      // Update session progress
      updateSessionProgress('questionsAnswered', currentSession.progress.questionsAnswered + 1);
      
      if (isCorrect) {
        updateSessionProgress('correctAnswers', currentSession.progress.correctAnswers + 1);
        updateSessionProgress('conceptsUnderstood', [currentQuestion.concept]);
      } else {
        updateSessionProgress('conceptsNeedsWork', [currentQuestion.concept]);
      }

      // Add feedback message
      const feedbackMessage: ChatMessage = {
        id: uuidv4(),
        content: response.content,
        role: 'assistant',
        timestamp: new Date(),
        context: learningContext
      };

      setChatMessages(prev => [...prev, feedbackMessage]);

      // Reset for next question
      setUserAnswer('');
      setCurrentQuestion(null);
      setShowHint(false);
      setHintLevel(0);

      // Decide next action based on performance
      setTimeout(() => {
        if (isCorrect) {
          // Generate another question or move to assessment
          if (currentSession.progress.correctAnswers >= 3) {
            setSessionMode('assessment');
          } else {
            generatePracticeQuestion();
          }
        } else {
          // Provide additional explanation
          provideAdditionalExplanation(currentQuestion.concept);
        }
      }, 2000);

    } catch (error) {
      console.error('Error assessing answer:', error);
    } finally {
      setIsAssessing(false);
    }
  };

  const provideAdditionalExplanation = async (concept: string) => {
    try {
      const response = await aiService.generateExplanation(
        concept,
        learningContext,
        'comprehensive'
      );

      const explanationMessage: ChatMessage = {
        id: uuidv4(),
        content: response.content,
        role: 'assistant',
        timestamp: new Date(),
        context: learningContext
      };

      setChatMessages(prev => [...prev, explanationMessage]);
      
      if (currentSession) {
        updateSessionProgress('explanationsGiven', currentSession.progress.explanationsGiven + 1);
      }
    } catch (error) {
      console.error('Error providing explanation:', error);
    }
  };

  const getHint = async () => {
    if (!currentQuestion) return;

    try {
      const response = await aiService.generateHint(
        currentQuestion.text,
        learningContext,
        hintLevel === 0 ? 'subtle' : hintLevel === 1 ? 'moderate' : 'explicit'
      );

      const hintMessage: ChatMessage = {
        id: uuidv4(),
        content: `💡 Hint: ${response.content}`,
        role: 'assistant',
        timestamp: new Date(),
        context: learningContext
      };

      setChatMessages(prev => [...prev, hintMessage]);
      setHintLevel(prev => prev + 1);
      setShowHint(true);
      
      if (currentSession) {
        updateSessionProgress('hintsProvided', currentSession.progress.hintsProvided + 1);
      }
    } catch (error) {
      console.error('Error generating hint:', error);
    }
  };

  const updateSessionProgress = (field: keyof TutoringProgress, value: any) => {
    if (!currentSession) return;

    const updatedProgress = {
      ...currentSession.progress,
      [field]: Array.isArray(currentSession.progress[field]) ? 
        [...new Set([...currentSession.progress[field], ...value])] : value
    };

    // Calculate current understanding
    const totalQuestions = updatedProgress.questionsAnswered;
    const correctAnswers = updatedProgress.correctAnswers;
    const currentUnderstanding = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    
    updatedProgress.currentUnderstanding = currentUnderstanding;

    const updatedSession = {
      ...currentSession,
      progress: updatedProgress,
      duration: Math.floor((new Date().getTime() - currentSession.startTime.getTime()) / 1000 / 60)
    };

    setCurrentSession(updatedSession);
    onProgressUpdate(updatedProgress);
  };

  const completeSession = async () => {
    if (!currentSession) return;

    // Generate final assessment and feedback
    const encouragementResponse = await aiService.generateEncouragement(
      learningContext,
      currentSession.progress.currentUnderstanding > 70 ? 'achieved' : 'progressing'
    );

    const finalOutcome = {
      ...currentSession.outcome,
      conceptsMastered: currentSession.progress.conceptsUnderstood,
      conceptsToReview: currentSession.progress.conceptsNeedsWork,
      overallScore: currentSession.progress.currentUnderstanding,
      engagement: 85, // Would be calculated from actual engagement metrics
      satisfaction: 90, // Would be collected from user feedback
      timeToMastery: currentSession.duration
    };

    const finalFeedback = {
      ...currentSession.feedback,
      encouragement: encouragementResponse.content,
      positive: ['Great engagement with the material', 'Thoughtful responses to questions'],
      constructive: currentSession.progress.conceptsNeedsWork.map(concept => 
        `Continue practicing with ${concept}`
      ),
      nextSession: 'Ready for the next module in your learning path'
    };

    const completedSession = {
      ...currentSession,
      endTime: new Date(),
      outcome: finalOutcome,
      feedback: finalFeedback
    };

    setCurrentSession(completedSession);
    onSessionComplete(completedSession);
  };

  const renderProgressBar = () => {
    if (!currentSession) return null;

    const progress = currentSession.progress;
    const totalConcepts = progress.conceptsIntroduced.length;
    const understoodConcepts = progress.conceptsUnderstood.length;
    const progressPercentage = totalConcepts > 0 ? (understoodConcepts / totalConcepts) * 100 : 0;

    return (
      <div className="bg-white rounded-lg p-4 border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Session Progress</span>
          <span className="text-sm text-gray-600">{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-600">
          <span>Understanding: {Math.round(progress.currentUnderstanding)}%</span>
          <span>Questions: {progress.correctAnswers}/{progress.questionsAnswered}</span>
        </div>
      </div>
    );
  };

  const renderSessionStats = () => {
    if (!currentSession) return null;

    const stats = [
      { icon: Target, label: 'Concepts Introduced', value: currentSession.progress.conceptsIntroduced.length },
      { icon: CheckCircle, label: 'Concepts Understood', value: currentSession.progress.conceptsUnderstood.length },
      { icon: HelpCircle, label: 'Hints Used', value: currentSession.progress.hintsProvided },
      { icon: Clock, label: 'Duration', value: `${currentSession.duration}m` }
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg p-3 border text-center">
            <stat.icon className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <div className="text-lg font-semibold">{stat.value}</div>
            <div className="text-xs text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>
    );
  };

  if (!currentSession) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Starting tutoring session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-lg p-4 border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <GraduationCap className="w-8 h-8 text-blue-500" />
            <div>
              <h2 className="text-xl font-semibold">Tutoring Session</h2>
              <p className="text-gray-600">{currentSession.topic}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`px-3 py-1 rounded-full text-sm ${
              sessionMode === 'topic_intro' ? 'bg-blue-100 text-blue-800' :
              sessionMode === 'practice' ? 'bg-green-100 text-green-800' :
              sessionMode === 'assessment' ? 'bg-purple-100 text-purple-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {sessionMode.replace('_', ' ')}
            </div>
            <button
              onClick={completeSession}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Complete Session
            </button>
          </div>
        </div>
      </div>

      {/* Progress and Stats */}
      {renderProgressBar()}
      {renderSessionStats()}

      {/* Chat Messages */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center space-x-2">
            <MessageSquare className="w-5 h-5" />
            <span>Learning Conversation</span>
          </h3>
        </div>
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {chatMessages.map((message, index) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl px-4 py-2 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Question */}
      {currentQuestion && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Practice Question</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Difficulty: {currentQuestion.difficulty}/10
              </span>
              <button
                onClick={getHint}
                className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200"
              >
                <Lightbulb className="w-4 h-4 inline mr-1" />
                Get Hint
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-800">{currentQuestion.text}</p>
            </div>
            
            <div className="space-y-2">
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
              
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <button
                    onClick={() => generatePracticeQuestion()}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Skip Question
                  </button>
                </div>
                <button
                  onClick={handleAnswerSubmit}
                  disabled={!userAnswer.trim() || isAssessing}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isAssessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Assessing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Submit Answer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        {sessionMode === 'topic_intro' && (
          <button
            onClick={generatePracticeQuestion}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center space-x-2"
          >
            <Brain className="w-5 h-5" />
            <span>Start Practice</span>
          </button>
        )}
        
        {sessionMode === 'practice' && !currentQuestion && (
          <button
            onClick={generatePracticeQuestion}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center space-x-2"
          >
            <HelpCircle className="w-5 h-5" />
            <span>Next Question</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default TutoringAssistant;