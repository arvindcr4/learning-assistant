import { v4 as uuidv4 } from 'uuid';

import { 
  ChatSession, 
  ChatMessage, 
  LearningContext, 
  ConversationState, 
  ConversationFlowStep, 
  ChatAnalytics,
  TutoringSession 
} from '../types';

export class ConversationService {
  private sessions: Map<string, ChatSession> = new Map();
  private conversationStates: Map<string, ConversationState> = new Map();
  private persistenceKey = 'learning-assistant-conversations';

  constructor() {
    this.loadSessionsFromStorage();
  }

  // Session Management
  createSession(userId: string, context: LearningContext): ChatSession {
    const session: ChatSession = {
      id: uuidv4(),
      userId,
      title: this.generateSessionTitle(context),
      messages: [],
      context,
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

    this.sessions.set(session.id, session);
    this.initializeConversationState(session.id);
    this.saveSessionsToStorage();
    
    return session;
  }

  getSession(sessionId: string): ChatSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getUserSessions(userId: string): ChatSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  updateSession(sessionId: string, updates: Partial<ChatSession>): ChatSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date()
    };

    this.sessions.set(sessionId, updatedSession);
    this.saveSessionsToStorage();
    
    return updatedSession;
  }

  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    this.conversationStates.delete(sessionId);
    this.saveSessionsToStorage();
    return deleted;
  }

  archiveSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'archived';
    session.updatedAt = new Date();
    this.saveSessionsToStorage();
    return true;
  }

  // Message Management
  addMessage(sessionId: string, message: ChatMessage): ChatSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.messages.push(message);
    session.totalMessages++;
    session.lastMessageAt = new Date();
    session.updatedAt = new Date();
    
    if (message.tokens) {
      session.totalTokens += message.tokens;
    }

    // Update conversation state
    this.updateConversationState(sessionId, message);
    
    this.saveSessionsToStorage();
    return session;
  }

  getRecentMessages(sessionId: string, limit: number = 10): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return session.messages.slice(-limit);
  }

  searchMessages(sessionId: string, query: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const lowercaseQuery = query.toLowerCase();
    return session.messages.filter(message => 
      message.content.toLowerCase().includes(lowercaseQuery)
    );
  }

  // Conversation State Management
  private initializeConversationState(sessionId: string): void {
    const state: ConversationState = {
      understandingLevel: 50,
      engagementLevel: 50,
      frustrationLevel: 0,
      needsHelp: false,
      lastInteraction: new Date(),
      conversationFlow: [],
      adaptiveActions: []
    };

    this.conversationStates.set(sessionId, state);
  }

  getConversationState(sessionId: string): ConversationState | null {
    return this.conversationStates.get(sessionId) || null;
  }

  updateConversationState(sessionId: string, message: ChatMessage): void {
    const state = this.conversationStates.get(sessionId);
    if (!state) return;

    // Update based on message content and metadata
    this.analyzeMessageForStateUpdate(state, message);
    
    // Add to conversation flow
    const flowStep: ConversationFlowStep = {
      id: uuidv4(),
      type: this.categorizeMessage(message),
      content: message.content,
      timestamp: message.timestamp,
      userResponse: message.role === 'user' ? message.content : undefined
    };

    state.conversationFlow.push(flowStep);
    state.lastInteraction = new Date();

    // Keep only recent flow steps
    if (state.conversationFlow.length > 20) {
      state.conversationFlow = state.conversationFlow.slice(-20);
    }

    this.conversationStates.set(sessionId, state);
  }

  private analyzeMessageForStateUpdate(state: ConversationState, message: ChatMessage): void {
    if (message.role === 'user') {
      // Analyze user message for engagement and understanding indicators
      const content = message.content.toLowerCase();
      
      // Check for understanding indicators
      if (content.includes('i understand') || content.includes('i get it') || content.includes('makes sense')) {
        state.understandingLevel = Math.min(100, state.understandingLevel + 10);
        state.frustrationLevel = Math.max(0, state.frustrationLevel - 5);
      }
      
      // Check for confusion indicators
      if (content.includes('confused') || content.includes('don\'t understand') || content.includes('unclear')) {
        state.understandingLevel = Math.max(0, state.understandingLevel - 10);
        state.frustrationLevel = Math.min(100, state.frustrationLevel + 10);
        state.needsHelp = true;
      }
      
      // Check for help requests
      if (content.includes('help') || content.includes('hint') || content.includes('explain')) {
        state.needsHelp = true;
      }
      
      // Update engagement based on message length and frequency
      const messageLength = message.content.length;
      if (messageLength > 50) {
        state.engagementLevel = Math.min(100, state.engagementLevel + 5);
      } else if (messageLength < 10) {
        state.engagementLevel = Math.max(0, state.engagementLevel - 2);
      }
    }
  }

  private categorizeMessage(message: ChatMessage): ConversationFlowStep['type'] {
    if (message.role === 'user') {
      const content = message.content.toLowerCase();
      if (content.includes('?')) return 'question';
      return 'question'; // Default for user messages
    } else {
      const content = message.content.toLowerCase();
      if (content.includes('great job') || content.includes('excellent') || content.includes('well done')) {
        return 'encouragement';
      }
      if (content.includes('let me explain') || content.includes('here\'s how')) {
        return 'explanation';
      }
      if (content.includes('quiz') || content.includes('test') || content.includes('assessment')) {
        return 'assessment';
      }
      return 'explanation'; // Default for assistant messages
    }
  }

  // Context Management
  updateLearningContext(sessionId: string, context: Partial<LearningContext>): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.context = { ...session.context, ...context };
    session.updatedAt = new Date();
    this.saveSessionsToStorage();
  }

  // Analytics
  generateSessionAnalytics(sessionId: string): ChatAnalytics | null {
    const session = this.sessions.get(sessionId);
    const state = this.conversationStates.get(sessionId);
    
    if (!session || !state) return null;

    const analytics: ChatAnalytics = {
      sessionId,
      userId: session.userId,
      totalMessages: session.totalMessages,
      totalTokens: session.totalTokens,
      averageResponseTime: this.calculateAverageResponseTime(session),
      topics: this.extractTopics(session),
      sentimentAnalysis: this.analyzeSentiment(session),
      engagementMetrics: this.calculateEngagementMetrics(session, state),
      learningProgress: this.analyzeLearningProgress(session, state),
      adaptiveEffectiveness: this.calculateAdaptiveEffectiveness(state),
      generatedAt: new Date()
    };

    return analytics;
  }

  private calculateAverageResponseTime(session: ChatSession): number {
    const messages = session.messages;
    if (messages.length < 2) return 0;

    let totalTime = 0;
    let responseCount = 0;

    for (let i = 1; i < messages.length; i++) {
      const prevMessage = messages[i - 1];
      const currentMessage = messages[i];
      
      if (prevMessage.role === 'user' && currentMessage.role === 'assistant') {
        const timeDiff = currentMessage.timestamp.getTime() - prevMessage.timestamp.getTime();
        totalTime += timeDiff;
        responseCount++;
      }
    }

    return responseCount > 0 ? totalTime / responseCount / 1000 : 0; // Convert to seconds
  }

  private extractTopics(session: ChatSession): any[] {
    // Simple topic extraction - in a real implementation, this would use NLP
    const topics = new Map<string, number>();
    
    session.messages.forEach(message => {
      if (message.role === 'user') {
        const words = message.content.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 4) { // Only consider longer words
            topics.set(word, (topics.get(word) || 0) + 1);
          }
        });
      }
    });

    return Array.from(topics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, frequency]) => ({
        topic,
        frequency,
        sentiment: 0.5, // Would be calculated with sentiment analysis
        understanding: 70, // Would be calculated based on context
        engagement: 80, // Would be calculated based on interaction patterns
        timeSpent: 5 // Would be calculated based on actual time tracking
      }));
  }

  private analyzeSentiment(session: ChatSession): any {
    // Simple sentiment analysis - in a real implementation, this would use NLP
    const userMessages = session.messages.filter(msg => msg.role === 'user');
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    userMessages.forEach(message => {
      const content = message.content.toLowerCase();
      if (content.includes('good') || content.includes('great') || content.includes('understand')) {
        positiveCount++;
      }
      if (content.includes('confused') || content.includes('difficult') || content.includes('hard')) {
        negativeCount++;
      }
    });

    const total = userMessages.length;
    const overall = total > 0 ? (positiveCount - negativeCount) / total : 0;

    return {
      overall,
      frustration: negativeCount / Math.max(total, 1) * 100,
      confidence: positiveCount / Math.max(total, 1) * 100,
      satisfaction: Math.max(0, overall + 0.5) * 100,
      engagement: Math.min(100, (positiveCount + negativeCount) / Math.max(total, 1) * 100),
      timeline: [] // Would include sentiment points over time
    };
  }

  private calculateEngagementMetrics(session: ChatSession, state: ConversationState): any {
    const userMessages = session.messages.filter(msg => msg.role === 'user');
    
    return {
      averageMessageLength: userMessages.length > 0 ? 
        userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / userMessages.length : 0,
      responseLatency: this.calculateAverageResponseTime(session),
      questionsAsked: userMessages.filter(msg => msg.content.includes('?')).length,
      questionsAnswered: session.messages.filter(msg => msg.role === 'assistant').length,
      initiativeTaken: userMessages.filter(msg => !msg.content.includes('?')).length,
      helpRequested: userMessages.filter(msg => 
        msg.content.toLowerCase().includes('help') || 
        msg.content.toLowerCase().includes('hint')
      ).length,
      sessionDuration: Math.floor((session.updatedAt.getTime() - session.createdAt.getTime()) / 1000 / 60),
      attentionSpan: state.conversationFlow.length > 0 ? 
        state.conversationFlow.length * 2 : 0 // Rough estimate
    };
  }

  private analyzeLearningProgress(session: ChatSession, state: ConversationState): any {
    // Extract learning progress from conversation
    const concepts = new Set<string>();
    const skills = new Set<string>();
    
    session.messages.forEach(message => {
      if (message.context?.currentModule) {
        concepts.add(message.context.currentModule);
      }
    });

    return {
      conceptsDiscussed: Array.from(concepts),
      conceptsLearned: Array.from(concepts).slice(0, Math.floor(concepts.size * 0.7)),
      mistakesCorreected: [],
      questionsResolved: session.messages.filter(msg => msg.role === 'assistant').length,
      skillsImproved: Array.from(skills),
      knowledgeGaps: [],
      progressRate: concepts.size / Math.max(session.totalMessages / 2, 1),
      retentionRate: 85 // Would be calculated based on assessment results
    };
  }

  private calculateAdaptiveEffectiveness(state: ConversationState): any {
    return {
      adaptationsTriggered: state.adaptiveActions.length,
      adaptationsSuccessful: state.adaptiveActions.filter(action => action.effectiveness && action.effectiveness > 70).length,
      difficultyAdjustments: state.adaptiveActions.filter(action => action.type === 'difficulty_adjustment').length,
      styleAdaptations: state.adaptiveActions.filter(action => action.type === 'explanation_style').length,
      engagementInterventions: state.adaptiveActions.filter(action => action.type === 'encouragement').length,
      averageEffectiveness: state.adaptiveActions.length > 0 ? 
        state.adaptiveActions.reduce((sum, action) => sum + (action.effectiveness || 0), 0) / state.adaptiveActions.length : 0,
      userSatisfaction: Math.max(0, 100 - state.frustrationLevel)
    };
  }

  // Utility Methods
  private generateSessionTitle(context: LearningContext): string {
    if (context.currentModule) {
      return `Learning: ${context.currentModule}`;
    }
    if (context.currentPath) {
      return `Path: ${context.currentPath}`;
    }
    return `Learning Session - ${new Date().toLocaleDateString()}`;
  }

  // Persistence
  private saveSessionsToStorage(): void {
    try {
      const sessionsData = Array.from(this.sessions.entries()).map(([id, session]) => ({
        id,
        session: {
          ...session,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
          lastMessageAt: session.lastMessageAt.toISOString(),
          messages: session.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString()
          }))
        }
      }));

      localStorage.setItem(this.persistenceKey, JSON.stringify(sessionsData));
    } catch (error) {
      console.error('Failed to save sessions to storage:', error);
    }
  }

  private loadSessionsFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.persistenceKey);
      if (!stored) return;

      const sessionsData = JSON.parse(stored);
      
      sessionsData.forEach(({ id, session }: any) => {
        const restoredSession: ChatSession = {
          ...session,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          lastMessageAt: new Date(session.lastMessageAt),
          messages: session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        };

        this.sessions.set(id, restoredSession);
        this.initializeConversationState(id);
      });
    } catch (error) {
      console.error('Failed to load sessions from storage:', error);
    }
  }

  // Export/Import
  exportSessions(userId: string): any {
    const userSessions = this.getUserSessions(userId);
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      userId,
      sessions: userSessions
    };
  }

  importSessions(data: any): boolean {
    try {
      if (data.version !== '1.0') {
        throw new Error('Unsupported export version');
      }

      data.sessions.forEach((session: ChatSession) => {
        // Restore date objects
        session.createdAt = new Date(session.createdAt);
        session.updatedAt = new Date(session.updatedAt);
        session.lastMessageAt = new Date(session.lastMessageAt);
        session.messages = session.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));

        this.sessions.set(session.id, session);
        this.initializeConversationState(session.id);
      });

      this.saveSessionsToStorage();
      return true;
    } catch (error) {
      console.error('Failed to import sessions:', error);
      return false;
    }
  }

  // Clear all data
  clearAllData(): void {
    this.sessions.clear();
    this.conversationStates.clear();
    localStorage.removeItem(this.persistenceKey);
  }
}

// Singleton instance
export const conversationService = new ConversationService();
export default conversationService;