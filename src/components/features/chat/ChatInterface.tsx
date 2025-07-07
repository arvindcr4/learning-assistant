'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Settings, RefreshCw, MessageSquare, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { formatDistanceToNow } from 'date-fns';

import { ChatMessage, ChatSession, LearningContext, AIResponse, StreamingResponse } from '../../../types';
import { aiService } from '../../../services/ai-service';
import VoiceInput from './VoiceInput';
import TextToSpeech from './TextToSpeech';

interface ChatInterfaceProps {
  userId: string;
  learningContext: LearningContext;
  onContextUpdate?: (context: LearningContext) => void;
  onSessionUpdate?: (session: ChatSession) => void;
  className?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  userId,
  learningContext,
  onContextUpdate,
  onSessionUpdate,
  className = ''
}) => {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoPlayResponses, setAutoPlayResponses] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Initialize chat session
  useEffect(() => {
    initializeSession();
  }, [userId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const initializeSession = () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      userId,
      title: 'New Learning Session',
      messages: [],
      context: learningContext,
      settings: {
        aiPersona: {
          name: 'Learning Assistant',
          type: 'educational_tutor',
          personality: 'Patient and encouraging',
          expertise: ['Education', 'Learning'],
          communicationStyle: 'encouraging',
          adaptiveLevel: 8
        },
        adaptiveMode: true,
        tutorialMode: true,
        assessmentMode: true,
        conversationStyle: 'guided',
        difficultyAdjustment: true,
        contextAwareness: true,
        proactiveHints: true,
        encouragementLevel: 'moderate'
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt: new Date(),
      totalTokens: 0,
      totalMessages: 0
    };

    setSession(newSession);
    
    // Add welcome message
    const welcomeMessage: ChatMessage = {
      id: uuidv4(),
      content: `Hello! I'm your learning assistant. I'm here to help you understand concepts, answer questions, and guide your learning journey. What would you like to explore today?`,
      role: 'assistant',
      timestamp: new Date(),
      context: learningContext
    };
    
    setMessages([welcomeMessage]);
    newSession.messages = [welcomeMessage];
    onSessionUpdate?.(newSession);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading || !session) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      content: inputMessage.trim(),
      role: 'user',
      timestamp: new Date(),
      context: learningContext
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Generate AI response with streaming
      await generateAIResponse(userMessage, updatedMessages);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, messages, session, learningContext, isLoading]);

  const generateAIResponse = async (userMessage: ChatMessage, currentMessages: ChatMessage[]) => {
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const conversationHistory = currentMessages.slice(-10); // Keep last 10 messages for context
      
      const response = await aiService.generateStreamingResponse(
        userMessage.content,
        learningContext,
        conversationHistory,
        session?.settings.aiPersona,
        (chunk: StreamingResponse) => {
          setStreamingContent(chunk.content);
        }
      );

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        content: response.content,
        role: 'assistant',
        timestamp: new Date(),
        context: learningContext,
        metadata: {
          confidence: response.confidence,
          sources: response.sources,
          suggestions: response.suggestions,
          followUpQuestions: response.followUpQuestions,
          tutorialPrompts: response.tutorialPrompts,
          assessmentTrigger: response.assessmentTrigger
        },
        tokens: response.metadata.tokens
      };

      const finalMessages = [...currentMessages, assistantMessage];
      setMessages(finalMessages);
      setStreamingContent('');

      // Update session
      if (session) {
        const updatedSession = {
          ...session,
          messages: finalMessages,
          updatedAt: new Date(),
          lastMessageAt: new Date(),
          totalTokens: session.totalTokens + (response.metadata.tokens || 0),
          totalMessages: session.totalMessages + 1
        };
        setSession(updatedSession);
        onSessionUpdate?.(updatedSession);
      }

      // Process adaptive actions
      if (response.adaptiveActions.length > 0) {
        processAdaptiveActions(response.adaptiveActions);
      }

    } catch (error) {
      console.error('Error generating AI response:', error);
      setError('Failed to generate response. Please try again.');
    } finally {
      setIsStreaming(false);
    }
  };

  const processAdaptiveActions = (adaptiveActions: any[]) => {
    // Process adaptive actions to update learning context
    adaptiveActions.forEach(action => {
      switch (action.type) {
        case 'difficulty_adjustment':
          // Update difficulty level
          break;
        case 'explanation_style':
          // Adapt explanation style
          break;
        case 'encouragement':
          // Provide encouragement
          break;
        case 'assessment_trigger':
          // Trigger assessment
          break;
      }
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceTranscription = useCallback((transcribedText: string) => {
    setInputMessage(transcribedText);
    // Auto-send the message after transcription
    setTimeout(() => {
      if (transcribedText.trim()) {
        handleSendMessage();
      }
    }, 500);
  }, [handleSendMessage]);

  const handleVoiceError = useCallback((error: string) => {
    setError(`Voice input error: ${error}`);
  }, []);

  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear this conversation?')) {
      setMessages([]);
      initializeSession();
    }
  };

  const renderMessage = (message: ChatMessage, index: number) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    
    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`flex max-w-3xl ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start space-x-2`}>
          <div className={`flex-shrink-0 ${isUser ? 'ml-2' : 'mr-2'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isUser ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'
            }`}>
              {isUser ? <User size={16} /> : <Bot size={16} />}
            </div>
          </div>
          
          <div className={`flex-1 ${isUser ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block px-4 py-2 rounded-lg ${
              isUser 
                ? 'bg-blue-500 text-white' 
                : isSystem 
                  ? 'bg-gray-100 text-gray-700 border'
                  : 'bg-white border text-gray-800'
            }`}>
              <div className="flex items-start justify-between">
                <div className="whitespace-pre-wrap flex-1">{message.content}</div>
                
                {/* Text-to-Speech for assistant messages */}
                {!isUser && voiceEnabled && (
                  <div className="ml-3 flex-shrink-0">
                    <TextToSpeech
                      text={message.content}
                      autoPlay={autoPlayResponses}
                      showControls={true}
                      onError={(error) => console.error('TTS Error:', error)}
                    />
                  </div>
                )}
              </div>
              
              {message.metadata?.followUpQuestions && message.metadata.followUpQuestions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">Follow-up questions:</p>
                  {message.metadata.followUpQuestions.map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInputMessage(question)}
                      className="block w-full text-left text-sm text-blue-600 hover:text-blue-800 mb-1"
                    >
                      • {question}
                    </button>
                  ))}
                </div>
              )}
              
              {message.metadata?.suggestions && message.metadata.suggestions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">Suggestions:</p>
                  {message.metadata.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="text-sm text-gray-700 mb-1">
                      • {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="text-xs text-gray-500 mt-1">
              {formatDistanceToNow(message.timestamp, { addSuffix: true })}
              {message.tokens && (
                <span className="ml-2">• {message.tokens} tokens</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStreamingMessage = () => {
    if (!isStreaming || !streamingContent) return null;

    return (
      <div className="flex justify-start mb-4">
        <div className="flex max-w-3xl flex-row items-start space-x-2">
          <div className="flex-shrink-0 mr-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500 text-white">
              <Bot size={16} />
            </div>
          </div>
          
          <div className="flex-1">
            <div className="inline-block px-4 py-2 rounded-lg bg-white border text-gray-800">
              <div className="whitespace-pre-wrap">{streamingContent}</div>
              <div className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1"></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-3">
          <MessageSquare className="w-6 h-6 text-blue-500" />
          <div>
            <h2 className="text-lg font-semibold">Learning Assistant</h2>
            <p className="text-sm text-gray-600">
              {session?.settings.aiPersona.name} • {session?.settings.conversationStyle}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={handleClearChat}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-100 border-b p-4">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Chat Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Voice Settings */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Voice Features</h4>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm">Enable Voice Input</label>
                  <input
                    type="checkbox"
                    checked={voiceEnabled}
                    onChange={(e) => setVoiceEnabled(e.target.checked)}
                    className="rounded"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm">Auto-play AI Responses</label>
                  <input
                    type="checkbox"
                    checked={autoPlayResponses}
                    onChange={(e) => setAutoPlayResponses(e.target.checked)}
                    className="rounded"
                  />
                </div>
              </div>

              {/* AI Settings */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">AI Behavior</h4>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm">Adaptive Mode</label>
                  <input
                    type="checkbox"
                    checked={session?.settings.adaptiveMode || false}
                    onChange={(e) => {
                      if (session) {
                        const updatedSession = {
                          ...session,
                          settings: {
                            ...session.settings,
                            adaptiveMode: e.target.checked
                          }
                        };
                        setSession(updatedSession);
                        onSessionUpdate?.(updatedSession);
                      }
                    }}
                    className="rounded"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm">Tutorial Mode</label>
                  <input
                    type="checkbox"
                    checked={session?.settings.tutorialMode || false}
                    onChange={(e) => {
                      if (session) {
                        const updatedSession = {
                          ...session,
                          settings: {
                            ...session.settings,
                            tutorialMode: e.target.checked
                          }
                        };
                        setSession(updatedSession);
                        onSessionUpdate?.(updatedSession);
                      }
                    }}
                    className="rounded"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => renderMessage(message, index))}
        {renderStreamingMessage()}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-white">
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about your learning..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          
          {/* Voice Input */}
          {voiceEnabled && (
            <VoiceInput
              onTranscription={handleVoiceTranscription}
              onError={handleVoiceError}
              disabled={isLoading}
              className="flex-shrink-0"
            />
          )}
          
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        
        {learningContext.currentModule && (
          <div className="mt-2 text-sm text-gray-600">
            Current topic: {learningContext.currentModule}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;