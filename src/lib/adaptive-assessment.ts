// Adaptive Assessment Engine - Intelligent quiz and assessment logic
import { 
  AdaptiveAssessment,
  AdaptiveQuestion,
  QuestionOption,
  AssessmentAdaptiveSettings,
  LearningSession,
  LearningProfile,
  LearningStyleType
} from '@/types';

export interface AssessmentState {
  currentQuestion: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  currentDifficulty: number;
  confidenceLevel: number;
  timeElapsed: number;
  responses: AssessmentResponse[];
  adaptiveChanges: AdaptiveChange[];
  shouldTerminate: boolean;
  terminationReason?: string;
}

export interface AssessmentResponse {
  questionId: string;
  selectedAnswer: string | string[];
  isCorrect: boolean;
  responseTime: number;
  difficulty: number;
  hintsUsed: number;
  attempts: number;
  confidence: number;
}

export interface AdaptiveChange {
  type: 'difficulty' | 'question_type' | 'hint' | 'break';
  reason: string;
  previousValue: any;
  newValue: any;
  timestamp: Date;
}

export interface QuestionSelection {
  question: AdaptiveQuestion;
  reasoning: string;
  adaptations: string[];
}

/**
 * Adaptive Assessment Configuration
 */
interface AdaptiveAssessmentConfig {
  DIFFICULTY_ADJUSTMENT_THRESHOLD: number;
  CONFIDENCE_THRESHOLD: number;
  MAX_CONSECUTIVE_INCORRECT: number;
  MIN_RESPONSE_TIME: number;
  MAX_RESPONSE_TIME: number;
  MIN_QUESTIONS_FOR_CONFIDENCE: number;
  STANDARD_ERROR_THRESHOLD: number;
  TERMINATION_CONFIDENCE_LEVEL: number;
  MAX_QUESTION_POOL_SIZE: number;
  INFORMATION_CRITERIA_WEIGHT: number;
}

export class AdaptiveAssessmentEngine {
  private readonly config: AdaptiveAssessmentConfig = {
    DIFFICULTY_ADJUSTMENT_THRESHOLD: 0.1,
    CONFIDENCE_THRESHOLD: 0.85,
    MAX_CONSECUTIVE_INCORRECT: 3,
    MIN_RESPONSE_TIME: 5, // seconds
    MAX_RESPONSE_TIME: 300, // seconds
    MIN_QUESTIONS_FOR_CONFIDENCE: 5,
    STANDARD_ERROR_THRESHOLD: 0.3,
    TERMINATION_CONFIDENCE_LEVEL: 0.95,
    MAX_QUESTION_POOL_SIZE: 1000,
    INFORMATION_CRITERIA_WEIGHT: 0.4
  };

  /**
   * Initializes a new adaptive assessment session
   */
  public initializeAssessment(
    assessment: AdaptiveAssessment,
    learningProfile: LearningProfile,
    initialDifficulty: number = 5
  ): AssessmentState {
    const settings = assessment.adaptiveSettings;
    
    return {
      currentQuestion: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      currentDifficulty: initialDifficulty,
      confidenceLevel: 0,
      timeElapsed: 0,
      responses: [],
      adaptiveChanges: [],
      shouldTerminate: false
    };
  }

  /**
   * Selects the next question based on current performance and learning profile
   */
  public selectNextQuestion(
    assessment: AdaptiveAssessment,
    state: AssessmentState,
    learningProfile: LearningProfile
  ): QuestionSelection | null {
    if (this.shouldTerminateAssessment(state, assessment.adaptiveSettings)) {
      return null;
    }

    // Filter questions by current difficulty and learning objectives
    const eligibleQuestions = this.filterEligibleQuestions(
      assessment.questions,
      state,
      learningProfile
    );

    if (eligibleQuestions.length === 0) {
      return null;
    }

    // Select question using adaptive algorithm
    const selectedQuestion = this.selectOptimalQuestion(
      eligibleQuestions,
      state,
      learningProfile
    );

    const adaptations = this.generateAdaptations(selectedQuestion, state, learningProfile);
    
    return {
      question: selectedQuestion,
      reasoning: this.generateSelectionReasoning(selectedQuestion, state),
      adaptations
    };
  }

  /**
   * Processes a student's response and updates assessment state
   */
  public processResponse(
    questionId: string,
    selectedAnswer: string | string[],
    responseTime: number,
    state: AssessmentState,
    question: AdaptiveQuestion,
    hintsUsed: number = 0,
    attempts: number = 1
  ): AssessmentState {
    const isCorrect = this.evaluateResponse(selectedAnswer, question.correctAnswer);
    const confidence = this.calculateResponseConfidence(responseTime, attempts, hintsUsed);

    const response: AssessmentResponse = {
      questionId,
      selectedAnswer,
      isCorrect,
      responseTime,
      difficulty: question.difficulty,
      hintsUsed,
      attempts,
      confidence
    };

    const newState = {
      ...state,
      currentQuestion: state.currentQuestion + 1,
      totalQuestions: state.totalQuestions + 1,
      correctAnswers: state.correctAnswers + (isCorrect ? 1 : 0),
      incorrectAnswers: state.incorrectAnswers + (isCorrect ? 0 : 1),
      timeElapsed: state.timeElapsed + responseTime,
      responses: [...state.responses, response]
    };

    // Apply adaptive changes based on response
    const adaptiveChanges = this.determineAdaptiveChanges(response, newState);
    
    if (adaptiveChanges.length > 0) {
      newState.adaptiveChanges = [...state.adaptiveChanges, ...adaptiveChanges];
      newState.currentDifficulty = this.applyDifficultyAdjustment(
        newState.currentDifficulty,
        adaptiveChanges
      );
    }

    // Update confidence level
    newState.confidenceLevel = this.calculateOverallConfidence(newState);

    return newState;
  }

  /**
   * Generates real-time hints based on student struggle patterns
   */
  public generateHint(
    question: AdaptiveQuestion,
    attempts: number,
    responseTime: number,
    previousResponses: AssessmentResponse[]
  ): string | null {
    const hintLevel = this.determineHintLevel(attempts, responseTime);
    
    if (hintLevel === 0 || question.hints.length === 0) {
      return null;
    }

    const hintIndex = Math.min(hintLevel - 1, question.hints.length - 1);
    return question.hints[hintIndex];
  }

  /**
   * Analyzes assessment performance and generates insights
   */
  public analyzePerformance(state: AssessmentState): AssessmentAnalysis {
    const accuracy = state.totalQuestions > 0 ? state.correctAnswers / state.totalQuestions : 0;
    const averageResponseTime = state.responses.reduce((sum, r) => sum + r.responseTime, 0) / state.responses.length;
    const difficultyProgression = this.analyzeDifficultyProgression(state.responses);
    const learningGaps = this.identifyLearningGaps(state.responses);
    const strengths = this.identifyStrengths(state.responses);
    const recommendations = this.generatePerformanceRecommendations(state);

    return {
      accuracy,
      averageResponseTime,
      difficultyProgression,
      learningGaps,
      strengths,
      recommendations,
      overallConfidence: state.confidenceLevel,
      timeEfficiency: this.calculateTimeEfficiency(state),
      adaptationEffectiveness: this.calculateAdaptationEffectiveness(state)
    };
  }

  /**
   * Generates personalized feedback based on performance patterns
   */
  public generatePersonalizedFeedback(
    state: AssessmentState,
    learningProfile: LearningProfile
  ): PersonalizedFeedback {
    const analysis = this.analyzePerformance(state);
    const feedbackMessages = this.generateFeedbackMessages(analysis, learningProfile);
    const nextSteps = this.generateNextSteps(analysis, learningProfile);
    const studyRecommendations = this.generateStudyRecommendations(analysis, learningProfile);

    return {
      overallPerformance: this.categorizePerformance(analysis.accuracy),
      feedbackMessages,
      nextSteps,
      studyRecommendations,
      motivationalMessage: this.generateMotivationalMessage(analysis, learningProfile)
    };
  }

  // Private helper methods

  private shouldTerminateAssessment(
    state: AssessmentState,
    settings: AssessmentAdaptiveSettings
  ): { shouldTerminate: boolean; reason: string; confidence: number } {
    // Input validation
    if (!state || !settings) {
      return { shouldTerminate: true, reason: 'Invalid state or settings', confidence: 0 };
    }

    // Hard maximum check
    if (state.totalQuestions >= settings.maximumQuestions) {
      return { shouldTerminate: true, reason: 'Maximum questions reached', confidence: 1.0 };
    }

    // Minimum questions requirement
    if (state.totalQuestions < settings.minimumQuestions) {
      return { shouldTerminate: false, reason: 'Minimum questions not reached', confidence: 0 };
    }

    // Statistical confidence termination
    const statisticalResult = this.checkStatisticalTermination(state, settings);
    if (statisticalResult.shouldTerminate) {
      return statisticalResult;
    }

    // Consecutive failures check (struggling student)
    const consecutiveFailures = this.checkConsecutiveFailures(state);
    if (consecutiveFailures.shouldTerminate) {
      return consecutiveFailures;
    }

    // Plateau detection (no learning progress)
    const plateauCheck = this.checkLearningPlateau(state);
    if (plateauCheck.shouldTerminate) {
      return plateauCheck;
    }

    // Time-based termination
    const timeCheck = this.checkTimeBasedTermination(state, settings);
    if (timeCheck.shouldTerminate) {
      return timeCheck;
    }

    return { shouldTerminate: false, reason: 'Assessment continuing', confidence: state.confidenceLevel };
  }

  /**
   * Check statistical termination criteria based on confidence intervals
   */
  private checkStatisticalTermination(
    state: AssessmentState,
    settings: AssessmentAdaptiveSettings
  ): { shouldTerminate: boolean; reason: string; confidence: number } {
    if (state.totalQuestions < this.config.MIN_QUESTIONS_FOR_CONFIDENCE) {
      return { shouldTerminate: false, reason: 'Insufficient data for statistical analysis', confidence: 0 };
    }

    const accuracy = state.totalQuestions > 0 ? state.correctAnswers / state.totalQuestions : 0;
    const targetAccuracy = settings.targetAccuracy / 100;
    
    // Calculate standard error
    const standardError = Math.sqrt((accuracy * (1 - accuracy)) / state.totalQuestions);
    
    // Check if we have sufficient confidence in our measurement
    if (standardError <= this.config.STANDARD_ERROR_THRESHOLD) {
      const confidenceInterval = 1.96 * standardError; // 95% confidence
      const lowerBound = accuracy - confidenceInterval;
      const upperBound = accuracy + confidenceInterval;
      
      // Check if target accuracy is within confidence interval
      if (lowerBound >= targetAccuracy && state.confidenceLevel >= this.config.CONFIDENCE_THRESHOLD) {
        return {
          shouldTerminate: true,
          reason: `Statistical confidence achieved (${(accuracy * 100).toFixed(1)}% ± ${(confidenceInterval * 100).toFixed(1)}%)`,
          confidence: this.config.TERMINATION_CONFIDENCE_LEVEL
        };
      }
    }

    return { shouldTerminate: false, reason: 'Statistical confidence not achieved', confidence: state.confidenceLevel };
  }

  /**
   * Check for consecutive failures indicating struggling student
   */
  private checkConsecutiveFailures(
    state: AssessmentState
  ): { shouldTerminate: boolean; reason: string; confidence: number } {
    if (state.responses.length < this.config.MAX_CONSECUTIVE_INCORRECT) {
      return { shouldTerminate: false, reason: 'Not enough responses to check failures', confidence: 0 };
    }

    const recentResponses = state.responses.slice(-this.config.MAX_CONSECUTIVE_INCORRECT);
    const allIncorrect = recentResponses.every(r => !r.isCorrect);
    
    if (allIncorrect) {
      // Additional check: are these questions too difficult?
      const avgDifficulty = recentResponses.reduce((sum, r) => sum + r.difficulty, 0) / recentResponses.length;
      
      return {
        shouldTerminate: true,
        reason: `Consecutive failures detected (${this.config.MAX_CONSECUTIVE_INCORRECT}) at difficulty ${avgDifficulty.toFixed(1)}`,
        confidence: 0.9
      };
    }

    return { shouldTerminate: false, reason: 'No consecutive failures detected', confidence: state.confidenceLevel };
  }

  /**
   * Check for learning plateau (no improvement over recent questions)
   */
  private checkLearningPlateau(
    state: AssessmentState
  ): { shouldTerminate: boolean; reason: string; confidence: number } {
    if (state.responses.length < 10) {
      return { shouldTerminate: false, reason: 'Not enough data for plateau detection', confidence: 0 };
    }

    const halfPoint = Math.floor(state.responses.length / 2);
    const firstHalf = state.responses.slice(0, halfPoint);
    const secondHalf = state.responses.slice(halfPoint);
    
    const firstHalfAccuracy = firstHalf.filter(r => r.isCorrect).length / firstHalf.length;
    const secondHalfAccuracy = secondHalf.filter(r => r.isCorrect).length / secondHalf.length;
    
    // Check if there's been no improvement (plateau)
    const improvement = secondHalfAccuracy - firstHalfAccuracy;
    
    if (improvement < -0.1 && state.totalQuestions >= 15) { // 10% decline over 15+ questions
      return {
        shouldTerminate: true,
        reason: `Learning plateau detected: ${(improvement * 100).toFixed(1)}% decline in recent performance`,
        confidence: 0.8
      };
    }

    return { shouldTerminate: false, reason: 'No learning plateau detected', confidence: state.confidenceLevel };
  }

  /**
   * Check time-based termination criteria
   */
  private checkTimeBasedTermination(
    state: AssessmentState,
    settings: AssessmentAdaptiveSettings
  ): { shouldTerminate: boolean; reason: string; confidence: number } {
    // Check for excessive total time
    if (state.timeElapsed > 3600) { // 1 hour
      return {
        shouldTerminate: true,
        reason: 'Maximum assessment time exceeded',
        confidence: 0.7
      };
    }

    // Check for excessive time on recent questions (fatigue indicator)
    const recentResponses = state.responses.slice(-3);
    if (recentResponses.length === 3) {
      const avgRecentTime = recentResponses.reduce((sum, r) => sum + r.responseTime, 0) / 3;
      
      if (avgRecentTime > this.config.MAX_RESPONSE_TIME) {
        return {
          shouldTerminate: true,
          reason: `Excessive response times detected (avg: ${avgRecentTime.toFixed(0)}s), suggesting fatigue`,
          confidence: 0.85
        };
      }
    }

    return { shouldTerminate: false, reason: 'Time criteria not met', confidence: state.confidenceLevel };
  }

  private filterEligibleQuestions(
    questions: AdaptiveQuestion[],
    state: AssessmentState,
    learningProfile: LearningProfile
  ): AdaptiveQuestion[] {
    const answeredQuestions = new Set(state.responses.map(r => r.questionId));
    const difficultyRange = this.calculateDifficultyRange(state.currentDifficulty);

    return questions.filter(question => {
      // Not already answered
      if (answeredQuestions.has(question.id)) {
        return false;
      }

      // Within difficulty range
      if (question.difficulty < difficultyRange.min || question.difficulty > difficultyRange.max) {
        return false;
      }

      return true;
    });
  }

  private selectOptimalQuestion(
    questions: AdaptiveQuestion[],
    state: AssessmentState,
    learningProfile: LearningProfile
  ): AdaptiveQuestion {
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('No questions available for selection');
    }

    // If only one question, return it
    if (questions.length === 1) {
      return questions[0];
    }

    // Limit question pool size for performance
    const limitedQuestions = questions.slice(0, this.config.MAX_QUESTION_POOL_SIZE);

    // Score each question based on multiple criteria with enhanced algorithms
    const scoredQuestions = limitedQuestions.map(question => {
      const score = this.calculateEnhancedQuestionScore(question, state, learningProfile);
      return {
        question,
        score,
        reasoning: this.generateSelectionReasoning(question, state)
      };
    });

    // Sort by score (highest first)
    scoredQuestions.sort((a, b) => b.score - a.score);

    // Add some randomization to prevent predictable patterns (top 3 candidates)
    const topCandidates = scoredQuestions.slice(0, Math.min(3, scoredQuestions.length));
    const weights = topCandidates.map((_, index) => Math.pow(0.7, index)); // Exponential decay
    const randomIndex = this.weightedRandomSelection(weights);

    return topCandidates[randomIndex].question;
  }

  /**
   * Enhanced question scoring with information theory principles
   */
  private calculateEnhancedQuestionScore(
    question: AdaptiveQuestion,
    state: AssessmentState,
    learningProfile: LearningProfile
  ): number {
    if (!question || !state || !learningProfile) {
      return 0;
    }

    let score = 0;
    const weights = {
      difficulty: 0.25,
      information: 0.30,
      style: 0.20,
      objective: 0.15,
      novelty: 0.10
    };

    try {
      // 1. Difficulty alignment (prefer questions near current ability)
      const difficultyScore = this.calculateDifficultyAlignment(question, state);
      score += difficultyScore * weights.difficulty;

      // 2. Information value (maximum information gain)
      const informationScore = this.calculateInformationValue(question, state);
      score += informationScore * weights.information;

      // 3. Learning style alignment
      const styleScore = this.calculateStyleAlignment(question, learningProfile);
      score += styleScore * weights.style;

      // 4. Learning objective coverage
      const objectiveScore = this.calculateObjectiveCoverage(question, state);
      score += objectiveScore * weights.objective;

      // 5. Novelty factor (avoid repetitive question types)
      const noveltyScore = this.calculateNoveltyScore(question, state);
      score += noveltyScore * weights.novelty;

      return Math.max(0, Math.min(1, score));
    } catch (error) {
      console.warn('Error calculating question score:', error);
      return 0.5; // Default neutral score
    }
  }

  /**
   * Calculate optimal difficulty alignment using item response theory
   */
  private calculateDifficultyAlignment(question: AdaptiveQuestion, state: AssessmentState): number {
    if (state.responses.length === 0) {
      return question.difficulty === 5 ? 1.0 : 0.8; // Prefer medium difficulty initially
    }

    // Estimate current ability level
    const recentResponses = state.responses.slice(-5);
    const currentAbility = this.estimateAbilityLevel(recentResponses);
    
    // Optimal difficulty should be slightly above current ability for maximum learning
    const optimalDifficulty = currentAbility + 0.5;
    const difficultyDifference = Math.abs(question.difficulty - optimalDifficulty);
    
    // Use exponential decay for alignment score
    return Math.exp(-difficultyDifference);
  }

  /**
   * Calculate information value using Fisher information
   */
  private calculateInformationValue(question: AdaptiveQuestion, state: AssessmentState): number {
    if (state.responses.length === 0) {
      return 0.8; // High information value for first questions
    }

    const currentAbility = this.estimateAbilityLevel(state.responses.slice(-5));
    const questionDifficulty = question.difficulty;
    
    // Fisher information is maximized when ability equals difficulty
    const probabilityCorrect = this.calculateProbabilityCorrect(currentAbility, questionDifficulty);
    const fisherInformation = probabilityCorrect * (1 - probabilityCorrect);
    
    // Normalize to 0-1 scale
    return fisherInformation * 4; // Max Fisher info is 0.25, so multiply by 4
  }

  /**
   * Estimate current ability level from responses
   */
  private estimateAbilityLevel(responses: AssessmentResponse[]): number {
    if (responses.length === 0) {
      return 5; // Default medium ability
    }

    // Weighted average of difficulties, weighted by correctness and confidence
    let weightedSum = 0;
    let totalWeight = 0;
    
    responses.forEach(response => {
      const weight = response.confidence * (response.isCorrect ? 1.2 : 0.8);
      const effectiveDifficulty = response.isCorrect ? response.difficulty : response.difficulty - 2;
      
      weightedSum += effectiveDifficulty * weight;
      totalWeight += weight;
    });
    
    const ability = totalWeight > 0 ? weightedSum / totalWeight : 5;
    return Math.max(1, Math.min(10, ability));
  }

  /**
   * Calculate probability of correct response using logistic model
   */
  private calculateProbabilityCorrect(ability: number, difficulty: number): number {
    const logit = ability - difficulty;
    return 1 / (1 + Math.exp(-logit));
  }

  /**
   * Calculate novelty score to avoid repetitive patterns
   */
  private calculateNoveltyScore(question: AdaptiveQuestion, state: AssessmentState): number {
    if (state.responses.length === 0) {
      return 1.0;
    }

    const recentQuestionTypes = state.responses.slice(-5).map(r => r.questionId);
    const sameTypeCount = recentQuestionTypes.filter(id => 
      id === question.id || this.areQuestionsSimilar(id, question.id)
    ).length;
    
    // Penalize repetitive question types
    return Math.max(0.2, 1 - sameTypeCount * 0.3);
  }

  /**
   * Check if two questions are similar (simplified)
   */
  private areQuestionsSimilar(questionId1: string, questionId2: string): boolean {
    // This would need more sophisticated similarity checking
    // For now, just check if they're the exact same question
    return questionId1 === questionId2;
  }

  /**
   * Weighted random selection from candidates
   */
  private weightedRandomSelection(weights: number[]): number {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;
    
    let cumulativeWeight = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        return i;
      }
    }
    
    return weights.length - 1; // Fallback to last option
  }

  /**
   * Legacy question scoring method (kept for compatibility)
   */
  private calculateQuestionScore(
    question: AdaptiveQuestion,
    state: AssessmentState,
    learningProfile: LearningProfile
  ): number {
    if (!question || !state || !learningProfile) {
      return 0;
    }

    try {
      let score = 0;

      // Difficulty alignment (prefer questions close to current difficulty)
      const difficultyAlignment = 1 - Math.abs(question.difficulty - state.currentDifficulty) / 10;
      score += Math.max(0, difficultyAlignment) * 0.3;

      // Learning objective coverage
      const objectiveCoverage = this.calculateObjectiveCoverage(question, state);
      score += Math.max(0, objectiveCoverage) * 0.2;

      // Learning style alignment
      const styleAlignment = this.calculateStyleAlignment(question, learningProfile);
      score += Math.max(0, styleAlignment) * 0.2;

      // Information value (how much this question reveals about student knowledge)
      const informationValue = this.calculateInformationValue(question, state);
      score += Math.max(0, informationValue) * 0.3;

      return Math.max(0, Math.min(1, score));
    } catch (error) {
      console.warn('Error in legacy question scoring:', error);
      return 0.5;
    }
  }

  private evaluateResponse(
    selectedAnswer: string | string[],
    correctAnswer: string | number | string[]
  ): boolean {
    if (Array.isArray(selectedAnswer) && Array.isArray(correctAnswer)) {
      return selectedAnswer.length === correctAnswer.length &&
             selectedAnswer.every(answer => correctAnswer.includes(answer));
    }

    return selectedAnswer.toString() === correctAnswer.toString();
  }

  private calculateResponseConfidence(
    responseTime: number,
    attempts: number,
    hintsUsed: number
  ): number {
    let confidence = 1.0;

    // Adjust for response time (too fast or too slow reduces confidence)
    if (responseTime < this.MIN_RESPONSE_TIME) {
      confidence *= 0.8; // Might be guessing
    } else if (responseTime > this.MAX_RESPONSE_TIME) {
      confidence *= 0.6; // Took too long
    }

    // Adjust for attempts
    confidence *= Math.pow(0.8, attempts - 1);

    // Adjust for hints used
    confidence *= Math.pow(0.7, hintsUsed);

    return Math.max(0, Math.min(1, confidence));
  }

  private determineAdaptiveChanges(
    response: AssessmentResponse,
    state: AssessmentState
  ): AdaptiveChange[] {
    const changes: AdaptiveChange[] = [];

    // Difficulty adjustment based on performance
    if (this.shouldAdjustDifficulty(response, state)) {
      const adjustment = response.isCorrect ? 0.5 : -0.5;
      changes.push({
        type: 'difficulty',
        reason: response.isCorrect ? 'Correct answer - increase difficulty' : 'Incorrect answer - decrease difficulty',
        previousValue: state.currentDifficulty,
        newValue: state.currentDifficulty + adjustment,
        timestamp: new Date()
      });
    }

    // Break suggestion for fatigue
    if (this.shouldSuggestBreak(response, state)) {
      changes.push({
        type: 'break',
        reason: 'Performance decline suggests fatigue',
        previousValue: 'continue',
        newValue: 'break_suggested',
        timestamp: new Date()
      });
    }

    return changes;
  }

  private shouldAdjustDifficulty(response: AssessmentResponse, state: AssessmentState): boolean {
    const recentResponses = state.responses.slice(-3);
    
    if (recentResponses.length < 3) {
      return false;
    }

    const recentAccuracy = recentResponses.filter(r => r.isCorrect).length / recentResponses.length;
    
    // Adjust if accuracy is consistently high or low
    return recentAccuracy >= 0.8 || recentAccuracy <= 0.3;
  }

  private shouldSuggestBreak(response: AssessmentResponse, state: AssessmentState): boolean {
    const recentResponses = state.responses.slice(-5);
    
    if (recentResponses.length < 5) {
      return false;
    }

    // Check for increasing response times (fatigue indicator)
    const responseTimes = recentResponses.map(r => r.responseTime);
    const averageTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    return response.responseTime > averageTime * 1.5;
  }

  private calculateDifficultyRange(currentDifficulty: number): { min: number; max: number } {
    const range = 1.5;
    return {
      min: Math.max(1, currentDifficulty - range),
      max: Math.min(10, currentDifficulty + range)
    };
  }

  private calculateOverallConfidence(state: AssessmentState): number {
    if (state.responses.length === 0) {
      return 0;
    }

    const weightedConfidence = state.responses.reduce((sum, response) => {
      return sum + response.confidence;
    }, 0) / state.responses.length;

    return Math.round(weightedConfidence * 100) / 100;
  }

  private applyDifficultyAdjustment(
    currentDifficulty: number,
    changes: AdaptiveChange[]
  ): number {
    let newDifficulty = currentDifficulty;

    changes.forEach(change => {
      if (change.type === 'difficulty') {
        newDifficulty = change.newValue;
      }
    });

    return Math.max(1, Math.min(10, newDifficulty));
  }

  private generateAdaptations(
    question: AdaptiveQuestion,
    state: AssessmentState,
    learningProfile: LearningProfile
  ): string[] {
    const adaptations: string[] = [];

    // Style-based adaptations
    if (learningProfile.dominantStyle === LearningStyleType.VISUAL && question.type === 'multiple-choice') {
      adaptations.push('Enhanced with visual elements');
    }

    // Difficulty adaptations
    if (question.difficulty > state.currentDifficulty) {
      adaptations.push('Difficulty increased based on recent performance');
    } else if (question.difficulty < state.currentDifficulty) {
      adaptations.push('Difficulty reduced for better comprehension');
    }

    return adaptations;
  }

  private generateSelectionReasoning(question: AdaptiveQuestion, state: AssessmentState): string {
    const reasons = [];

    reasons.push(`Selected difficulty ${question.difficulty} (current: ${state.currentDifficulty})`);
    reasons.push(`Targeting learning objective: ${question.learningObjective}`);
    
    if (state.responses.length > 0) {
      const recentAccuracy = state.responses.slice(-3).filter(r => r.isCorrect).length / Math.min(3, state.responses.length);
      reasons.push(`Based on recent accuracy: ${Math.round(recentAccuracy * 100)}%`);
    }

    return reasons.join('. ');
  }

  private determineHintLevel(attempts: number, responseTime: number): number {
    if (attempts === 1 && responseTime < 30) {
      return 0; // No hint needed
    }

    if (attempts === 2 || responseTime > 60) {
      return 1; // Subtle hint
    }

    if (attempts >= 3 || responseTime > 120) {
      return 2; // More explicit hint
    }

    return 0;
  }

  private calculateObjectiveCoverage(question: AdaptiveQuestion, state: AssessmentState): number {
    // Count how many questions have covered this learning objective
    const objectiveQuestions = state.responses.filter(r => 
      // This would need to be looked up from the question database
      false // Placeholder
    );

    // Prefer objectives that haven't been covered much
    return Math.max(0, 1 - objectiveQuestions.length / 5);
  }

  private calculateStyleAlignment(question: AdaptiveQuestion, learningProfile: LearningProfile): number {
    // This would need to be based on question metadata about learning styles
    // For now, return a neutral score
    return 0.5;
  }

  private calculateInformationValue(question: AdaptiveQuestion, state: AssessmentState): number {
    // Questions at the current difficulty level provide the most information
    const difficultyDistance = Math.abs(question.difficulty - state.currentDifficulty);
    return Math.max(0, 1 - difficultyDistance / 5);
  }

  private analyzeDifficultyProgression(responses: AssessmentResponse[]): DifficultyAnalysis {
    const difficulties = responses.map(r => r.difficulty);
    const averageDifficulty = difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length;
    
    return {
      startDifficulty: difficulties[0] || 5,
      endDifficulty: difficulties[difficulties.length - 1] || 5,
      averageDifficulty,
      progression: this.calculateProgression(difficulties)
    };
  }

  private calculateProgression(difficulties: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (difficulties.length < 2) return 'stable';
    
    const firstHalf = difficulties.slice(0, Math.floor(difficulties.length / 2));
    const secondHalf = difficulties.slice(Math.floor(difficulties.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, d) => sum + d, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg + 0.5) return 'increasing';
    if (secondAvg < firstAvg - 0.5) return 'decreasing';
    return 'stable';
  }

  private identifyLearningGaps(responses: AssessmentResponse[]): LearningGap[] {
    // Group incorrect responses by learning objective
    const incorrectByObjective = new Map<string, AssessmentResponse[]>();
    
    responses.filter(r => !r.isCorrect).forEach(response => {
      // This would need question metadata to get learning objectives
      const objective = 'placeholder'; // response.learningObjective;
      
      if (!incorrectByObjective.has(objective)) {
        incorrectByObjective.set(objective, []);
      }
      incorrectByObjective.get(objective)!.push(response);
    });

    return Array.from(incorrectByObjective.entries()).map(([objective, responses]) => ({
      learningObjective: objective,
      gapSeverity: this.calculateGapSeverity(responses),
      incorrectCount: responses.length,
      averageDifficulty: responses.reduce((sum, r) => sum + r.difficulty, 0) / responses.length,
      recommendedActions: this.generateGapRecommendations(responses)
    }));
  }

  private identifyStrengths(responses: AssessmentResponse[]): Strength[] {
    // Group correct responses by learning objective
    const correctByObjective = new Map<string, AssessmentResponse[]>();
    
    responses.filter(r => r.isCorrect).forEach(response => {
      const objective = 'placeholder'; // response.learningObjective;
      
      if (!correctByObjective.has(objective)) {
        correctByObjective.set(objective, []);
      }
      correctByObjective.get(objective)!.push(response);
    });

    return Array.from(correctByObjective.entries()).map(([objective, responses]) => ({
      learningObjective: objective,
      strengthLevel: this.calculateStrengthLevel(responses),
      correctCount: responses.length,
      averageDifficulty: responses.reduce((sum, r) => sum + r.difficulty, 0) / responses.length,
      averageConfidence: responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length
    }));
  }

  private calculateGapSeverity(responses: AssessmentResponse[]): 'low' | 'medium' | 'high' {
    const averageConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
    
    if (averageConfidence < 0.3) return 'high';
    if (averageConfidence < 0.6) return 'medium';
    return 'low';
  }

  private calculateStrengthLevel(responses: AssessmentResponse[]): 'emerging' | 'developing' | 'strong' {
    const averageConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
    const averageDifficulty = responses.reduce((sum, r) => sum + r.difficulty, 0) / responses.length;
    
    if (averageConfidence > 0.8 && averageDifficulty > 6) return 'strong';
    if (averageConfidence > 0.6 && averageDifficulty > 4) return 'developing';
    return 'emerging';
  }

  private generateGapRecommendations(responses: AssessmentResponse[]): string[] {
    return [
      'Review fundamental concepts in this area',
      'Practice with easier questions first',
      'Seek additional resources or tutoring',
      'Break down complex problems into smaller steps'
    ];
  }

  private generatePerformanceRecommendations(state: AssessmentState): string[] {
    const recommendations = [];
    const accuracy = state.correctAnswers / state.totalQuestions;
    
    if (accuracy < 0.6) {
      recommendations.push('Focus on reviewing foundational concepts');
      recommendations.push('Practice with easier questions to build confidence');
    } else if (accuracy > 0.8) {
      recommendations.push('Try more challenging questions to advance your skills');
      recommendations.push('Consider exploring advanced topics in this area');
    }

    const avgResponseTime = state.responses.reduce((sum, r) => sum + r.responseTime, 0) / state.responses.length;
    
    if (avgResponseTime > 120) {
      recommendations.push('Work on improving response speed through practice');
    }

    return recommendations;
  }

  private calculateTimeEfficiency(state: AssessmentState): number {
    const avgResponseTime = state.responses.reduce((sum, r) => sum + r.responseTime, 0) / state.responses.length;
    const accuracy = state.correctAnswers / state.totalQuestions;
    
    // Efficiency = accuracy / time (normalized)
    return (accuracy * 100) / Math.max(30, avgResponseTime);
  }

  private calculateAdaptationEffectiveness(state: AssessmentState): number {
    // Measure how well adaptations improved performance
    const changes = state.adaptiveChanges.filter(c => c.type === 'difficulty');
    
    if (changes.length === 0) return 0;

    let effectiveness = 0;
    changes.forEach(change => {
      // Find responses before and after the change
      const changeTime = change.timestamp.getTime();
      const beforeResponses = state.responses.filter(r => r.responseTime < changeTime);
      const afterResponses = state.responses.filter(r => r.responseTime >= changeTime);
      
      if (beforeResponses.length > 0 && afterResponses.length > 0) {
        const beforeAccuracy = beforeResponses.filter(r => r.isCorrect).length / beforeResponses.length;
        const afterAccuracy = afterResponses.filter(r => r.isCorrect).length / afterResponses.length;
        
        effectiveness += (afterAccuracy - beforeAccuracy);
      }
    });

    return effectiveness / changes.length;
  }

  private generateFeedbackMessages(analysis: AssessmentAnalysis, learningProfile: LearningProfile): string[] {
    const messages = [];
    
    if (analysis.accuracy > 0.8) {
      messages.push('Excellent work! You demonstrated strong understanding of the material.');
    } else if (analysis.accuracy > 0.6) {
      messages.push('Good effort! You\'re on the right track with room for improvement.');
    } else {
      messages.push('Keep working at it! Focus on understanding the fundamentals.');
    }

    if (analysis.difficultyProgression.progression === 'increasing') {
      messages.push('Great progress! You successfully tackled increasingly difficult questions.');
    }

    return messages;
  }

  private generateNextSteps(analysis: AssessmentAnalysis, learningProfile: LearningProfile): string[] {
    const steps = [];
    
    if (analysis.learningGaps.length > 0) {
      steps.push('Review areas where you struggled: ' + analysis.learningGaps.map(gap => gap.learningObjective).join(', '));
    }

    if (analysis.accuracy > 0.8) {
      steps.push('Challenge yourself with more advanced topics');
    }

    return steps;
  }

  private generateStudyRecommendations(analysis: AssessmentAnalysis, learningProfile: LearningProfile): string[] {
    const recommendations = [];
    
    // Style-based recommendations
    if (learningProfile.dominantStyle === LearningStyleType.VISUAL) {
      recommendations.push('Use diagrams and visual aids for complex concepts');
    } else if (learningProfile.dominantStyle === LearningStyleType.AUDITORY) {
      recommendations.push('Explain concepts aloud or join study groups');
    }

    return recommendations;
  }

  private categorizePerformance(accuracy: number): 'excellent' | 'good' | 'needs_improvement' {
    if (accuracy > 0.8) return 'excellent';
    if (accuracy > 0.6) return 'good';
    return 'needs_improvement';
  }

  private generateMotivationalMessage(analysis: AssessmentAnalysis, learningProfile: LearningProfile): string {
    if (analysis.accuracy > 0.8) {
      return 'Outstanding performance! Your dedication to learning is really showing.';
    } else if (analysis.accuracy > 0.6) {
      return 'You\'re making solid progress! Keep up the consistent effort.';
    } else {
      return 'Every expert was once a beginner. Keep practicing and you\'ll see improvement!';
    }
  }
}

// Supporting interfaces
export interface AssessmentAnalysis {
  accuracy: number;
  averageResponseTime: number;
  difficultyProgression: DifficultyAnalysis;
  learningGaps: LearningGap[];
  strengths: Strength[];
  recommendations: string[];
  overallConfidence: number;
  timeEfficiency: number;
  adaptationEffectiveness: number;
}

export interface DifficultyAnalysis {
  startDifficulty: number;
  endDifficulty: number;
  averageDifficulty: number;
  progression: 'increasing' | 'decreasing' | 'stable';
}

export interface LearningGap {
  learningObjective: string;
  gapSeverity: 'low' | 'medium' | 'high';
  incorrectCount: number;
  averageDifficulty: number;
  recommendedActions: string[];
}

export interface Strength {
  learningObjective: string;
  strengthLevel: 'emerging' | 'developing' | 'strong';
  correctCount: number;
  averageDifficulty: number;
  averageConfidence: number;
}

export interface PersonalizedFeedback {
  overallPerformance: 'excellent' | 'good' | 'needs_improvement';
  feedbackMessages: string[];
  nextSteps: string[];
  studyRecommendations: string[];
  motivationalMessage: string;
}