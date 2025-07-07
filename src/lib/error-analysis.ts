// Comprehensive Error Analysis and Feedback Engine
import type { LearningSession, AdaptiveQuestion } from '@/types';
import { generateUUID } from '@/utils/uuid';

export interface ErrorPattern {
  id: string;
  errorType: 'conceptual' | 'procedural' | 'factual' | 'metacognitive';
  frequency: number;
  severity: 'low' | 'medium' | 'high';
  topics: string[];
  description: string;
  recommendations: string[];
  detectedAt: Date;
}

export interface PersonalizedFeedback {
  immediate: string;
  explanatory: string;
  constructive: string;
  motivational: string;
  nextSteps: string[];
}

export class ErrorAnalysisEngine {
  public analyzeErrors(sessions: LearningSession[]): ErrorPattern[] {
    // Analyze error patterns from learning sessions
    const patterns: ErrorPattern[] = [];
    
    // Group errors by topic and type
    const errorsByTopic = new Map<string, any[]>();
    
    sessions.forEach(session => {
      const accuracy = session.totalQuestions > 0 ? session.correctAnswers / session.totalQuestions : 0;
      if (accuracy < 0.8) {
        // High error rate - analyze further
        const topic = 'general'; // This would come from session metadata
        if (!errorsByTopic.has(topic)) {
          errorsByTopic.set(topic, []);
        }
        errorsByTopic.get(topic)!.push({
          sessionId: session.id,
          accuracy,
          errors: session.totalQuestions - session.correctAnswers
        });
      }
    });

    // Generate error patterns
    errorsByTopic.forEach((errors, topic) => {
      if (errors.length >= 3) {
        patterns.push({
          id: generateUUID(),
          errorType: 'conceptual',
          frequency: errors.length,
          severity: errors.length > 5 ? 'high' : 'medium',
          topics: [topic],
          description: `Recurring difficulties in ${topic}`,
          recommendations: [
            `Review fundamental concepts in ${topic}`,
            'Practice with easier examples first',
            'Seek additional resources or help'
          ],
          detectedAt: new Date()
        });
      }
    });

    return patterns;
  }

  public generatePersonalizedFeedback(
    question: AdaptiveQuestion,
    userAnswer: string,
    isCorrect: boolean,
    attempts: number
  ): PersonalizedFeedback {
    if (isCorrect) {
      return {
        immediate: 'Correct! Well done.',
        explanatory: question.explanation,
        constructive: 'Your understanding of this concept is solid.',
        motivational: 'Keep up the excellent work!',
        nextSteps: ['Continue to the next topic', 'Try a more challenging question']
      };
    } else {
      return {
        immediate: 'Not quite right. Let\'s work through this together.',
        explanatory: question.explanation,
        constructive: `Your answer suggests you might need to review the key concept of ${question.learningObjective}.`,
        motivational: attempts > 1 ? 'Keep trying - learning takes practice!' : 'Don\'t worry, this is a common mistake.',
        nextSteps: [
          'Review the explanation carefully',
          'Try a similar practice question',
          'Ask for help if you\'re still unsure'
        ]
      };
    }
  }
}