import { 
  ChatSession, 
  ChatMessage, 
  TutoringSession, 
  LearningContext, 
  Progress, 
  LearningAnalytics,
  ChatAnalytics,
  StudySession,
  ConversationState
} from '../types';

import { conversationService } from './conversation-service';
import { chatStorage } from './chat-storage';

export interface LearningProgressUpdate {
  userId: string;
  moduleId: string;
  conceptsLearned: string[];
  conceptsStruggling: string[];
  timeSpent: number; // minutes
  engagementLevel: number; // 0-100
  comprehensionLevel: number; // 0-100
  questionsAnswered: number;
  correctAnswers: number;
  hintsUsed: number;
  source: 'chat' | 'tutoring' | 'assessment';
  sessionId: string;
}

export interface LearningInsight {
  type: 'strength' | 'weakness' | 'recommendation' | 'milestone';
  title: string;
  description: string;
  confidence: number; // 0-100
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
  relatedConcepts: string[];
  suggestedActions: string[];
}

export class LearningProgressIntegration {
  private progressUpdates: Map<string, LearningProgressUpdate[]> = new Map();
  private insights: Map<string, LearningInsight[]> = new Map();

  // Main Integration Methods
  async updateProgressFromChatSession(sessionId: string): Promise<LearningProgressUpdate | null> {
    const session = conversationService.getSession(sessionId);
    if (!session) return null;

    const conversationState = conversationService.getConversationState(sessionId);
    if (!conversationState) return null;

    const update = this.analyzeChatSessionForProgress(session, conversationState);
    
    if (update) {
      await this.recordProgressUpdate(update);
      await this.generateInsights(update);
    }

    return update;
  }

  async updateProgressFromTutoringSession(tutoringSession: TutoringSession): Promise<LearningProgressUpdate | null> {
    const update = this.analyzeTutoringSessionForProgress(tutoringSession);
    
    if (update) {
      await this.recordProgressUpdate(update);
      await this.generateInsights(update);
    }

    return update;
  }

  async generateLearningAnalytics(userId: string, timeRange?: { start: Date; end: Date }): Promise<LearningAnalytics> {
    const userSessions = conversationService.getUserSessions(userId);
    const progressUpdates = this.getProgressUpdates(userId, timeRange);
    const insights = this.getUserInsights(userId);

    return this.compileLearningAnalytics(userId, userSessions, progressUpdates, insights, timeRange);
  }

  async getLearningRecommendations(userId: string, context: LearningContext): Promise<LearningInsight[]> {
    const progressUpdates = this.getProgressUpdates(userId);
    const recentSessions = conversationService.getUserSessions(userId).slice(0, 5);
    
    return this.generatePersonalizedRecommendations(userId, context, progressUpdates, recentSessions);
  }

  // Progress Analysis Methods
  private analyzeChatSessionForProgress(
    session: ChatSession, 
    conversationState: ConversationState
  ): LearningProgressUpdate | null {
    const userMessages = session.messages.filter(msg => msg.role === 'user');
    const assistantMessages = session.messages.filter(msg => msg.role === 'assistant');
    
    if (userMessages.length === 0) return null;

    // Extract concepts discussed
    const conceptsLearned = this.extractConceptsFromMessages(assistantMessages, 'learned');
    const conceptsStruggling = this.extractConceptsFromMessages(userMessages, 'struggling');

    // Calculate time spent (rough estimate)
    const timeSpent = Math.max(
      Math.floor((session.lastMessageAt.getTime() - session.createdAt.getTime()) / 1000 / 60),
      1
    );

    // Calculate engagement level
    const engagementLevel = this.calculateEngagementLevel(session, conversationState);

    // Calculate comprehension level
    const comprehensionLevel = conversationState.understandingLevel;

    // Count questions and answers
    const questionsAnswered = this.countQuestionsAnswered(session.messages);
    const correctAnswers = this.estimateCorrectAnswers(session.messages, conversationState);

    // Count hints used (from metadata)
    const hintsUsed = this.countHintsUsed(session.messages);

    return {
      userId: session.userId,
      moduleId: session.context.currentModule || 'general',
      conceptsLearned,
      conceptsStruggling,
      timeSpent,
      engagementLevel,
      comprehensionLevel,
      questionsAnswered,
      correctAnswers,
      hintsUsed,
      source: 'chat',
      sessionId: session.id
    };
  }

  private analyzeTutoringSessionForProgress(session: TutoringSession): LearningProgressUpdate {
    return {
      userId: session.userId,
      moduleId: session.topic,
      conceptsLearned: session.progress.conceptsUnderstood,
      conceptsStruggling: session.progress.conceptsNeedsWork,
      timeSpent: session.duration,
      engagementLevel: session.outcome.engagement,
      comprehensionLevel: session.progress.currentUnderstanding,
      questionsAnswered: session.progress.questionsAnswered,
      correctAnswers: session.progress.correctAnswers,
      hintsUsed: session.progress.hintsProvided,
      source: 'tutoring',
      sessionId: session.id
    };
  }

  // Insight Generation
  private async generateInsights(update: LearningProgressUpdate): Promise<void> {
    const insights: LearningInsight[] = [];

    // Generate strength insights
    if (update.conceptsLearned.length > 0) {
      insights.push({
        type: 'strength',
        title: 'Concepts Mastered',
        description: `Successfully learned ${update.conceptsLearned.length} concepts: ${update.conceptsLearned.join(', ')}`,
        confidence: Math.min(95, update.comprehensionLevel + 10),
        actionable: false,
        priority: 'low',
        relatedConcepts: update.conceptsLearned,
        suggestedActions: ['Continue building on these strengths', 'Apply concepts in new contexts']
      });
    }

    // Generate weakness insights
    if (update.conceptsStruggling.length > 0) {
      insights.push({
        type: 'weakness',
        title: 'Areas Needing Attention',
        description: `Struggling with ${update.conceptsStruggling.length} concepts: ${update.conceptsStruggling.join(', ')}`,
        confidence: Math.max(60, 100 - update.comprehensionLevel),
        actionable: true,
        priority: update.comprehensionLevel < 50 ? 'high' : 'medium',
        relatedConcepts: update.conceptsStruggling,
        suggestedActions: [
          'Schedule additional practice sessions',
          'Review foundational concepts',
          'Seek help from tutor or peers'
        ]
      });
    }

    // Generate engagement insights
    if (update.engagementLevel < 40) {
      insights.push({
        type: 'recommendation',
        title: 'Low Engagement Detected',
        description: 'Your engagement level seems to be decreasing. Consider trying different learning approaches.',
        confidence: 80,
        actionable: true,
        priority: 'medium',
        relatedConcepts: [],
        suggestedActions: [
          'Try interactive learning activities',
          'Take regular breaks',
          'Connect concepts to personal interests',
          'Study in shorter, focused sessions'
        ]
      });
    }

    // Generate milestone insights
    if (update.comprehensionLevel >= 80 && update.correctAnswers >= 5) {
      insights.push({
        type: 'milestone',
        title: 'Excellent Progress!',
        description: `You've achieved ${update.comprehensionLevel}% comprehension with ${update.correctAnswers} correct answers. Great work!`,
        confidence: 95,
        actionable: false,
        priority: 'low',
        relatedConcepts: update.conceptsLearned,
        suggestedActions: ['Continue to the next module', 'Challenge yourself with advanced topics']
      });
    }

    // Store insights
    if (insights.length > 0) {
      const existingInsights = this.insights.get(update.userId) || [];
      this.insights.set(update.userId, [...existingInsights, ...insights]);
    }
  }

  private async generatePersonalizedRecommendations(
    userId: string,
    context: LearningContext,
    progressUpdates: LearningProgressUpdate[],
    recentSessions: ChatSession[]
  ): Promise<LearningInsight[]> {
    const recommendations: LearningInsight[] = [];

    if (progressUpdates.length === 0) return recommendations;

    // Analyze overall progress trends
    const avgComprehension = this.calculateAverageComprehension(progressUpdates);
    const avgEngagement = this.calculateAverageEngagement(progressUpdates);
    const strugglingConcepts = this.getRecurringStrugglingConcepts(progressUpdates);
    const masteredConcepts = this.getConsistentlyMasteredConcepts(progressUpdates);

    // Generate style-specific recommendations
    if (context.learningStyle) {
      recommendations.push(...this.getStyleSpecificRecommendations(context.learningStyle, avgEngagement));
    }

    // Generate difficulty-specific recommendations
    if (avgComprehension < 40) {
      recommendations.push({
        type: 'recommendation',
        title: 'Consider Reducing Difficulty',
        description: 'Your comprehension levels suggest the current material might be too challenging. Consider reviewing fundamentals.',
        confidence: 85,
        actionable: true,
        priority: 'high',
        relatedConcepts: strugglingConcepts,
        suggestedActions: [
          'Review prerequisite concepts',
          'Work through beginner-level materials',
          'Ask for simplified explanations',
          'Practice with easier examples'
        ]
      });
    } else if (avgComprehension > 85) {
      recommendations.push({
        type: 'recommendation',
        title: 'Ready for Advanced Material',
        description: 'Your high comprehension levels suggest you\'re ready for more challenging content.',
        confidence: 90,
        actionable: true,
        priority: 'medium',
        relatedConcepts: masteredConcepts,
        suggestedActions: [
          'Progress to advanced topics',
          'Explore real-world applications',
          'Take on challenging projects',
          'Mentor other learners'
        ]
      });
    }

    // Generate time-based recommendations
    const totalTimeSpent = progressUpdates.reduce((sum, update) => sum + update.timeSpent, 0);
    const avgSessionTime = totalTimeSpent / progressUpdates.length;

    if (avgSessionTime < 10) {
      recommendations.push({
        type: 'recommendation',
        title: 'Consider Longer Study Sessions',
        description: 'Your sessions are quite short. Longer focused sessions might improve learning outcomes.',
        confidence: 70,
        actionable: true,
        priority: 'low',
        relatedConcepts: [],
        suggestedActions: [
          'Aim for 15-20 minute focused sessions',
          'Set specific learning goals before starting',
          'Create a distraction-free environment'
        ]
      });
    } else if (avgSessionTime > 60) {
      recommendations.push({
        type: 'recommendation',
        title: 'Take More Breaks',
        description: 'Your sessions are quite long. Regular breaks can help maintain focus and retention.',
        confidence: 80,
        actionable: true,
        priority: 'medium',
        relatedConcepts: [],
        suggestedActions: [
          'Take 5-10 minute breaks every 25-30 minutes',
          'Use the Pomodoro Technique',
          'Include physical movement in breaks'
        ]
      });
    }

    return recommendations;
  }

  // Utility Methods
  private extractConceptsFromMessages(messages: ChatMessage[], type: 'learned' | 'struggling'): string[] {
    const concepts: Set<string> = new Set();

    messages.forEach(message => {
      const content = message.content.toLowerCase();
      
      if (type === 'learned') {
        // Look for positive indicators
        if (content.includes('understand') || content.includes('clear') || content.includes('got it')) {
          // Extract potential concepts (this would be more sophisticated in practice)
          const words = content.split(' ');
          words.forEach(word => {
            if (word.length > 4 && !['understand', 'clear', 'concept'].includes(word)) {
              concepts.add(word);
            }
          });
        }
      } else {
        // Look for confusion indicators
        if (content.includes('confused') || content.includes('difficult') || content.includes('don\'t understand')) {
          const words = content.split(' ');
          words.forEach(word => {
            if (word.length > 4 && !['confused', 'difficult', 'understand'].includes(word)) {
              concepts.add(word);
            }
          });
        }
      }
    });

    return Array.from(concepts).slice(0, 5); // Limit to top 5
  }

  private calculateEngagementLevel(session: ChatSession, state: ConversationState): number {
    let engagement = state.engagementLevel;

    // Adjust based on session characteristics
    const avgMessageLength = session.messages
      .filter(msg => msg.role === 'user')
      .reduce((sum, msg) => sum + msg.content.length, 0) / 
      Math.max(session.messages.filter(msg => msg.role === 'user').length, 1);

    if (avgMessageLength > 100) engagement += 10;
    if (avgMessageLength < 20) engagement -= 10;

    // Adjust based on question asking
    const questionsAsked = session.messages
      .filter(msg => msg.role === 'user' && msg.content.includes('?')).length;
    
    engagement += questionsAsked * 5;

    return Math.max(0, Math.min(100, engagement));
  }

  private countQuestionsAnswered(messages: ChatMessage[]): number {
    // Count assistant messages that seem to be responding to questions
    return messages.filter(msg => 
      msg.role === 'assistant' && 
      (msg.content.includes('answer') || msg.content.includes('correct') || msg.content.includes('yes') || msg.content.includes('no'))
    ).length;
  }

  private estimateCorrectAnswers(messages: ChatMessage[], state: ConversationState): number {
    const questionsAnswered = this.countQuestionsAnswered(messages);
    const comprehensionRate = state.understandingLevel / 100;
    return Math.floor(questionsAnswered * comprehensionRate);
  }

  private countHintsUsed(messages: ChatMessage[]): number {
    return messages.filter(msg => 
      msg.role === 'assistant' && 
      (msg.content.includes('hint') || msg.content.includes('💡'))
    ).length;
  }

  private calculateAverageComprehension(updates: LearningProgressUpdate[]): number {
    if (updates.length === 0) return 0;
    return updates.reduce((sum, update) => sum + update.comprehensionLevel, 0) / updates.length;
  }

  private calculateAverageEngagement(updates: LearningProgressUpdate[]): number {
    if (updates.length === 0) return 0;
    return updates.reduce((sum, update) => sum + update.engagementLevel, 0) / updates.length;
  }

  private getRecurringStrugglingConcepts(updates: LearningProgressUpdate[]): string[] {
    const conceptCounts = new Map<string, number>();
    
    updates.forEach(update => {
      update.conceptsStruggling.forEach(concept => {
        conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
      });
    });

    return Array.from(conceptCounts.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([concept, _]) => concept)
      .slice(0, 5);
  }

  private getConsistentlyMasteredConcepts(updates: LearningProgressUpdate[]): string[] {
    const conceptCounts = new Map<string, number>();
    
    updates.forEach(update => {
      update.conceptsLearned.forEach(concept => {
        conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
      });
    });

    return Array.from(conceptCounts.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([concept, _]) => concept)
      .slice(0, 5);
  }

  private getStyleSpecificRecommendations(learningStyle: string, avgEngagement: number): LearningInsight[] {
    const recommendations: LearningInsight[] = [];

    if (avgEngagement < 50) {
      const styleRecommendations = {
        visual: 'Try using diagrams, mind maps, and visual representations',
        auditory: 'Consider discussion-based learning and verbal explanations',
        reading: 'Focus on text-based materials and note-taking',
        kinesthetic: 'Incorporate hands-on activities and real-world applications'
      };

      const recommendation = styleRecommendations[learningStyle as keyof typeof styleRecommendations];
      
      if (recommendation) {
        recommendations.push({
          type: 'recommendation',
          title: `Optimize for ${learningStyle} Learning`,
          description: recommendation,
          confidence: 75,
          actionable: true,
          priority: 'medium',
          relatedConcepts: [],
          suggestedActions: [recommendation]
        });
      }
    }

    return recommendations;
  }

  private compileLearningAnalytics(
    userId: string,
    sessions: ChatSession[],
    progressUpdates: LearningProgressUpdate[],
    insights: LearningInsight[],
    timeRange?: { start: Date; end: Date }
  ): LearningAnalytics {
    const filteredSessions = timeRange ? 
      sessions.filter(s => s.createdAt >= timeRange.start && s.createdAt <= timeRange.end) :
      sessions;

    const totalTimeSpent = progressUpdates.reduce((sum, update) => sum + update.timeSpent, 0);
    const totalQuestions = progressUpdates.reduce((sum, update) => sum + update.questionsAnswered, 0);
    const totalCorrect = progressUpdates.reduce((sum, update) => sum + update.correctAnswers, 0);
    const avgComprehension = this.calculateAverageComprehension(progressUpdates);

    return {
      id: userId + '_analytics',
      userId,
      timeRange: timeRange || {
        start: filteredSessions[filteredSessions.length - 1]?.createdAt || new Date(),
        end: new Date()
      },
      overallProgress: {
        totalTimeSpent,
        contentCompleted: progressUpdates.length,
        averageScore: avgComprehension,
        completionRate: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
        retentionRate: 85, // Would be calculated from assessment data
        streakDays: this.calculateStreakDays(filteredSessions),
        goalsAchieved: insights.filter(i => i.type === 'milestone').length,
        totalGoals: Math.max(10, progressUpdates.length) // Rough estimate
      },
      styleEffectiveness: [], // Would be populated with actual style analysis
      paceAnalysis: {
        averagePace: totalTimeSpent > 0 ? progressUpdates.length / (totalTimeSpent / 60) : 0,
        optimalPace: 2, // Concepts per hour
        paceConsistency: 75, // Would be calculated from variance
        fatiguePattern: {
          onsetTime: 30,
          recoveryTime: 10,
          indicators: ['Decreased engagement', 'Shorter responses'],
          severity: 'low'
        },
        peakPerformanceTime: '10:00 AM', // Would be calculated from session times
        recommendedBreaks: 2
      },
      contentEngagement: [], // Would be populated with content analysis
      performanceTrends: [], // Would be calculated from historical data
      recommendations: insights.filter(i => i.type === 'recommendation').map(insight => ({
        id: insight.title.toLowerCase().replace(/\s+/g, '_'),
        type: 'content',
        title: insight.title,
        description: insight.description,
        reasoning: insight.description,
        confidence: insight.confidence,
        priority: insight.priority,
        actionRequired: insight.actionable,
        estimatedImpact: insight.confidence,
        createdAt: new Date()
      })),
      predictions: [], // Would be generated from ML models
      generatedAt: new Date()
    };
  }

  private calculateStreakDays(sessions: ChatSession[]): number {
    if (sessions.length === 0) return 0;

    const sessionDates = sessions
      .map(s => s.createdAt.toDateString())
      .filter((date, index, arr) => arr.indexOf(date) === index)
      .sort();

    let streak = 1;
    let currentStreak = 1;

    for (let i = 1; i < sessionDates.length; i++) {
      const prevDateString = sessionDates[i - 1];
      const currentDateString = sessionDates[i];
      if (!prevDateString || !currentDateString) continue;
      
      const prevDate = new Date(prevDateString);
      const currentDate = new Date(currentDateString);
      const dayDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      if (dayDiff === 1) {
        currentStreak++;
        streak = Math.max(streak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return streak;
  }

  // Data Management
  private async recordProgressUpdate(update: LearningProgressUpdate): Promise<void> {
    const userUpdates = this.progressUpdates.get(update.userId) || [];
    userUpdates.push(update);
    this.progressUpdates.set(update.userId, userUpdates);

    // Store in persistent storage
    await chatStorage.saveToLocalStorage(`progress_${update.userId}`, userUpdates);
  }

  private getProgressUpdates(userId: string, timeRange?: { start: Date; end: Date }): LearningProgressUpdate[] {
    const updates = this.progressUpdates.get(userId) || [];
    
    if (!timeRange) return updates;
    
    // Filter by time range (would need to add timestamp to updates)
    return updates; // Simplified for now
  }

  private getUserInsights(userId: string): LearningInsight[] {
    return this.insights.get(userId) || [];
  }

  // Public API
  async getProgressSummary(userId: string): Promise<{
    totalSessions: number;
    totalTimeSpent: number;
    averageComprehension: number;
    currentStreak: number;
    recentInsights: LearningInsight[];
  }> {
    const progressUpdates = this.getProgressUpdates(userId);
    const insights = this.getUserInsights(userId);
    const sessions = conversationService.getUserSessions(userId);

    return {
      totalSessions: sessions.length,
      totalTimeSpent: progressUpdates.reduce((sum, update) => sum + update.timeSpent, 0),
      averageComprehension: this.calculateAverageComprehension(progressUpdates),
      currentStreak: this.calculateStreakDays(sessions),
      recentInsights: insights.slice(-5)
    };
  }

  async clearUserData(userId: string): Promise<void> {
    this.progressUpdates.delete(userId);
    this.insights.delete(userId);
  }
}

// Export singleton instance
export const learningProgressIntegration = new LearningProgressIntegration();
export default learningProgressIntegration;