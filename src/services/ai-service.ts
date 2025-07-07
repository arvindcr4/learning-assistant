import axios, { AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { TamboAI } from '@tambo-ai/typescript-sdk';
import { errorHandler } from './error-handler';

import { 
  AIConfig, 
  AIPersona, 
  AIResponse, 
  ChatMessage, 
  LearningContext, 
  StreamingResponse,
  AdaptiveAction,
  TutorialPrompt,
  LearningStyleType
} from '../types';

/**
 * Rate limiting and token management interfaces
 */
interface RateLimit {
  requests: number;
  tokens: number;
  resetTime: number;
}

interface TokenBudget {
  daily: number;
  monthly: number;
  used: number;
  remaining: number;
}

interface AIServiceConfig {
  MAX_REQUESTS_PER_MINUTE: number;
  MAX_TOKENS_PER_REQUEST: number;
  MAX_DAILY_TOKENS: number;
  MAX_MONTHLY_TOKENS: number;
  PROMPT_INJECTION_PATTERNS: RegExp[];
  MAX_INPUT_LENGTH: number;
  RATE_LIMIT_WINDOW: number;
}

/**
 * Input sanitization utilities
 */
class InputSanitizer {
  private static readonly DANGEROUS_PATTERNS = [
    /(?:ignore|forget|disregard)\s+(?:previous|above|prior)\s+(?:instructions?|prompts?|context)/gi,
    /\b(?:system|admin|root)\s*:?\s*["']?[^"'\n]*["']?/gi,
    /\b(?:execute|eval|run)\s*\(/gi,
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /\$\{[^}]*\}/g,
    /\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b/gi
  ];

  static sanitize(input: string): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }

    let sanitized = input.trim();
    
    // Remove potentially dangerous patterns
    this.DANGEROUS_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[FILTERED]');
    });

    // Limit length
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000) + '...';
    }

    return sanitized;
  }

  static validatePromptInjection(input: string): boolean {
    const injectionPatterns = [
      /(?:ignore|forget|disregard).*(?:previous|above|prior)/i,
      /(?:you are|act as|pretend to be).*(?:different|another|new)/i,
      /(?:roleplay|role-play).*(?:as|being)/i,
      /(?:new|different)\s+(?:instructions?|prompts?|rules?)/i
    ];

    return !injectionPatterns.some(pattern => pattern.test(input));
  }

  static estimateTokens(text: string): number {
    // Rough token estimation (4 characters ≈ 1 token)
    return Math.ceil(text.length / 4);
  }
}

export class AIService {
  private config: AIConfig;
  private defaultPersona: AIPersona;
  private serviceConfig: AIServiceConfig;
  private rateLimits: Map<string, RateLimit> = new Map();
  private tokenBudget: TokenBudget;
  private requestQueue: Array<{ resolve: Function; reject: Function; request: any }> = [];
  private isProcessingQueue = false;
  private tamboClient: TamboAI;

  constructor() {
    this.config = this.loadConfig();
    this.defaultPersona = this.createDefaultPersona();
    this.serviceConfig = this.loadServiceConfig();
    this.tokenBudget = this.initializeTokenBudget();
    this.tamboClient = this.initializeTamboClient();
    this.startRateLimitReset();
  }

  private loadServiceConfig(): AIServiceConfig {
    return {
      MAX_REQUESTS_PER_MINUTE: parseInt(process.env.AI_MAX_REQUESTS_PER_MINUTE || '60'),
      MAX_TOKENS_PER_REQUEST: parseInt(process.env.AI_MAX_TOKENS_PER_REQUEST || '4000'),
      MAX_DAILY_TOKENS: parseInt(process.env.AI_MAX_DAILY_TOKENS || '100000'),
      MAX_MONTHLY_TOKENS: parseInt(process.env.AI_MAX_MONTHLY_TOKENS || '1000000'),
      PROMPT_INJECTION_PATTERNS: [],
      MAX_INPUT_LENGTH: parseInt(process.env.AI_MAX_INPUT_LENGTH || '10000'),
      RATE_LIMIT_WINDOW: 60000 // 1 minute
    };
  }

  private initializeTokenBudget(): TokenBudget {
    return {
      daily: this.serviceConfig.MAX_DAILY_TOKENS,
      monthly: this.serviceConfig.MAX_MONTHLY_TOKENS,
      used: 0,
      remaining: this.serviceConfig.MAX_DAILY_TOKENS
    };
  }

  private startRateLimitReset(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, limit] of this.rateLimits.entries()) {
        if (now >= limit.resetTime) {
          this.rateLimits.delete(key);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  private initializeTamboClient(): TamboAI {
    return new TamboAI({
      apiKey: process.env.TAMBO_API_KEY || '',
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'staging',
    });
  }

  private loadConfig(): AIConfig {
    return {
      apiKey: process.env.TAMBO_API_KEY || '',
      baseUrl: process.env.TAMBO_AI_BASE_URL || '',
      model: process.env.TAMBO_AI_MODEL || 'tambo-chat-v1',
      maxTokens: parseInt(process.env.TAMBO_AI_MAX_TOKENS || '2000'),
      temperature: parseFloat(process.env.TAMBO_AI_TEMPERATURE || '0.7'),
      persona: this.createDefaultPersona(),
      language: process.env.LEARNING_ASSISTANT_LANGUAGE || 'en'
    };
  }

  private createDefaultPersona(): AIPersona {
    return {
      name: process.env.LEARNING_ASSISTANT_NAME || 'Learning Assistant',
      type: 'educational_tutor',
      personality: 'I am a patient, encouraging, and knowledgeable learning assistant. I adapt my teaching style to match your learning preferences and help you understand complex concepts through clear explanations and guided practice.',
      expertise: [
        'Educational pedagogy',
        'Adaptive learning',
        'Personalized instruction',
        'Learning assessment',
        'Skill development',
        'Knowledge retention',
        'Critical thinking',
        'Problem-solving'
      ],
      communicationStyle: 'encouraging',
      adaptiveLevel: 8
    };
  }

  async generateResponse(
    message: string,
    context: LearningContext,
    conversationHistory: ChatMessage[] = [],
    persona?: AIPersona
  ): Promise<AIResponse> {
    return errorHandler.handleError(async () => {
      // Input validation and sanitization
      if (!message || typeof message !== 'string') {
        throw new Error('Invalid message input');
      }

      if (!context || !context.userId) {
        throw new Error('Invalid learning context');
      }

      // Sanitize input
      const sanitizedMessage = InputSanitizer.sanitize(message);
      
      // Check for prompt injection
      if (!InputSanitizer.validatePromptInjection(sanitizedMessage)) {
        throw new Error('Potential prompt injection detected');
      }

      // Check rate limits
      await this.checkRateLimit(context.userId);

      // Estimate token usage
      const estimatedTokens = this.estimateRequestTokens(sanitizedMessage, conversationHistory, persona);
      
      // Check token budget
      if (!this.checkTokenBudget(estimatedTokens)) {
        throw new Error('Token budget exceeded');
      }

      const systemPrompt = this.buildSystemPrompt(persona || this.defaultPersona, context);
      const userPrompt = this.buildUserPrompt(sanitizedMessage, context);
      
      const response = await this.callTamboAPI(systemPrompt, userPrompt, conversationHistory);
      
      // Update token usage
      this.updateTokenUsage(response.usage?.total_tokens || estimatedTokens);
      
      return this.processAIResponse(response, context);
    }, context, 'ai_response').catch(error => {
      // Return fallback response for handled errors
      return errorHandler.generateFallbackAIResponse(error, context);
    });
  }

  async generateStreamingResponse(
    message: string,
    context: LearningContext,
    conversationHistory: ChatMessage[] = [],
    persona?: AIPersona,
    onChunk?: (chunk: StreamingResponse) => void
  ): Promise<AIResponse> {
    return errorHandler.handleError(async () => {
      // Input validation and sanitization (same as generateResponse)
      if (!message || typeof message !== 'string') {
        throw new Error('Invalid message input');
      }

      if (!context || !context.userId) {
        throw new Error('Invalid learning context');
      }

      const sanitizedMessage = InputSanitizer.sanitize(message);
      
      if (!InputSanitizer.validatePromptInjection(sanitizedMessage)) {
        throw new Error('Potential prompt injection detected');
      }

      await this.checkRateLimit(context.userId);
      
      const estimatedTokens = this.estimateRequestTokens(sanitizedMessage, conversationHistory, persona);
      
      if (!this.checkTokenBudget(estimatedTokens)) {
        throw new Error('Token budget exceeded');
      }

      const systemPrompt = this.buildSystemPrompt(persona || this.defaultPersona, context);
      const userPrompt = this.buildUserPrompt(sanitizedMessage, context);
      
      const response = await this.callTamboStreamingAPI(
        systemPrompt, 
        userPrompt, 
        conversationHistory, 
        onChunk
      );
      
      this.updateTokenUsage(response.usage?.total_tokens || estimatedTokens);
      
      return this.processAIResponse(response, context);
    }, context, 'ai_streaming').catch(error => {
      // Return fallback response for handled errors
      return errorHandler.generateFallbackAIResponse(error, context);
    });
  }

  private buildSystemPrompt(persona: AIPersona, context: LearningContext): string {
    // Sanitize all context inputs
    const sanitizedContext = {
      userId: InputSanitizer.sanitize(context.userId || ''),
      currentModule: InputSanitizer.sanitize(context.currentModule || 'None'),
      currentPath: InputSanitizer.sanitize(context.currentPath || 'None'),
      learningStyle: InputSanitizer.sanitize(context.learningStyle || 'Not determined'),
      difficultyLevel: InputSanitizer.sanitize(context.difficultyLevel?.toString() || 'Not set'),
      strengths: context.strengths?.map(s => InputSanitizer.sanitize(s)).slice(0, 5) || [],
      weaknesses: context.weaknesses?.map(w => InputSanitizer.sanitize(w)).slice(0, 5) || [],
      recentMistakes: context.recentMistakes?.map(m => InputSanitizer.sanitize(m)).slice(0, 3) || []
    };

    const basePrompt = `You are ${persona.name}, a ${persona.type} with expertise in ${persona.expertise.join(', ')}.

Personality: ${persona.personality}

Communication Style: ${persona.communicationStyle}

Current Learning Context:
- User ID: [PROTECTED]
- Current Module: ${sanitizedContext.currentModule}
- Learning Path: ${sanitizedContext.currentPath}
- Learning Style: ${sanitizedContext.learningStyle}
- Difficulty Level: ${sanitizedContext.difficultyLevel}
- Progress: ${context.progress ? `${context.progress.completedModules.length} modules completed, current score: ${context.progress.currentScore}` : 'No progress data'}

Recent Context:
- Strengths: ${sanitizedContext.strengths.join(', ') || 'None identified'}
- Weaknesses: ${sanitizedContext.weaknesses.join(', ') || 'None identified'}
- Recent Mistakes: ${sanitizedContext.recentMistakes.join(', ') || 'None recorded'}

Safety Guidelines:
1. Never execute code or commands
2. Don't access external systems or files
3. Focus only on educational content
4. Report inappropriate requests
5. Maintain user privacy and data protection

Instructions:
1. Adapt your responses to the user's learning style and difficulty level
2. Be encouraging and supportive while maintaining educational rigor
3. Break down complex concepts into digestible parts
4. Use examples and analogies relevant to the user's context
5. Ask clarifying questions when needed
6. Provide hints rather than direct answers when appropriate
7. Suggest follow-up questions or activities
8. Monitor for signs of frustration or confusion
9. Celebrate progress and learning milestones
10. Maintain a growth mindset approach

Remember: Your goal is to facilitate learning, not just provide information. Guide the user through the learning process rather than simply giving answers.`;

    return basePrompt;
  }

  private buildUserPrompt(message: string, context: LearningContext): string {
    const sanitizedModule = InputSanitizer.sanitize(context.currentModule || 'General discussion');
    const sanitizedStyle = InputSanitizer.sanitize(context.learningStyle || 'unknown');
    const sanitizedDifficulty = InputSanitizer.sanitize(context.difficultyLevel?.toString() || 'unknown');
    
    const contextualPrompt = `Current learning context: ${sanitizedModule}

User message: ${message}

Please respond in a way that:
1. Addresses the user's specific question or need
2. Considers their learning style (${sanitizedStyle})
3. Matches their difficulty level (${sanitizedDifficulty})
4. Builds upon their current progress
5. Provides appropriate educational support
6. Stays within educational boundaries
7. Maintains appropriate content safety

If this appears to be a question about a specific concept, provide:
- A clear, tailored explanation
- Relevant examples
- Follow-up questions to check understanding
- Suggestions for practice or further learning

If the user seems confused or frustrated, provide:
- Encouragement and support
- Simpler explanations
- Different approaches to the same concept
- Offer to break down the problem into smaller parts

If the request is inappropriate or outside educational scope:
- Politely redirect to educational topics
- Maintain focus on learning objectives
- Suggest appropriate alternatives`;

    return contextualPrompt;
  }

  /**
   * Rate limiting implementation
   */
  private async checkRateLimit(userId: string): Promise<void> {
    const now = Date.now();
    const key = `${userId}:${Math.floor(now / this.serviceConfig.RATE_LIMIT_WINDOW)}`;
    
    const limit = this.rateLimits.get(key) || {
      requests: 0,
      tokens: 0,
      resetTime: now + this.serviceConfig.RATE_LIMIT_WINDOW
    };

    if (limit.requests >= this.serviceConfig.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = limit.resetTime - now;
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    limit.requests++;
    this.rateLimits.set(key, limit);
  }

  /**
   * Token budget management
   */
  private checkTokenBudget(estimatedTokens: number): boolean {
    if (this.tokenBudget.used + estimatedTokens > this.tokenBudget.daily) {
      return false;
    }
    return true;
  }

  private updateTokenUsage(tokensUsed: number): void {
    this.tokenBudget.used += tokensUsed;
    this.tokenBudget.remaining = Math.max(0, this.tokenBudget.daily - this.tokenBudget.used);
  }

  /**
   * Estimate token usage for a request
   */
  private estimateRequestTokens(
    message: string,
    conversationHistory: ChatMessage[],
    persona?: AIPersona
  ): number {
    let totalTokens = 0;
    
    // Estimate system prompt tokens
    totalTokens += InputSanitizer.estimateTokens(this.defaultPersona.personality);
    totalTokens += 500; // Base system prompt
    
    // Estimate user message tokens
    totalTokens += InputSanitizer.estimateTokens(message);
    
    // Estimate conversation history tokens
    conversationHistory.forEach(msg => {
      totalTokens += InputSanitizer.estimateTokens(msg.content);
    });
    
    // Estimate response tokens (conservative estimate)
    totalTokens += Math.min(this.config.maxTokens, 2000);
    
    return totalTokens;
  }

  /**
   * Get current token budget status
   */
  public getTokenBudgetStatus(): TokenBudget {
    return { ...this.tokenBudget };
  }

  /**
   * Reset daily token budget
   */
  public resetDailyTokenBudget(): void {
    this.tokenBudget.used = 0;
    this.tokenBudget.remaining = this.tokenBudget.daily;
  }

  /**
   * Enhanced memory management for streaming responses
   */
  private manageStreamingMemory(chunk: any): void {
    // Implement memory cleanup for large streaming responses
    if (process.memoryUsage().heapUsed > 500 * 1024 * 1024) { // 500MB threshold
      console.warn('High memory usage detected, implementing cleanup');
      if (global.gc) {
        global.gc();
      }
    }
  }

  private async callTamboAPI(
    systemPrompt: string,
    userPrompt: string,
    conversationHistory: ChatMessage[]
  ): Promise<any> {
    try {
      // Convert chat messages to Tambo format
      const messages = [
        { role: 'system' as const, content: [{ type: 'text' as const, text: systemPrompt }] },
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: [{ type: 'text' as const, text: msg.content }]
        })),
        { role: 'user' as const, content: [{ type: 'text' as const, text: userPrompt }] }
      ];

      // Use Tambo SDK to advance the thread
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        throw new Error('No message to send');
      }

      const response = await this.tamboClient.beta.threads.advance({
        messageToAppend: lastMessage
      });

      // Transform Tambo response to match expected format
      return {
        id: (response as any).id || uuidv4(),
        choices: [{
          message: {
            content: this.extractTextFromTamboResponse(response)
          }
        }],
        usage: {
          total_tokens: this.estimateTokensFromResponse(response)
        }
      };
    } catch (error) {
      console.error('Tambo API Error:', error);
      throw new Error(`Tambo API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractTextFromTamboResponse(response: any): string {
    // Extract text content from Tambo response format
    if (response.content && Array.isArray(response.content)) {
      return response.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join(' ');
    }
    
    // Fallback for different response formats
    if (typeof response === 'string') {
      return response;
    }
    
    if (response.text) {
      return response.text;
    }
    
    return 'No response content available';
  }

  private estimateTokensFromResponse(response: any): number {
    const text = this.extractTextFromTamboResponse(response);
    return InputSanitizer.estimateTokens(text);
  }

  private async callTamboStreamingAPI(
    systemPrompt: string,
    userPrompt: string,
    conversationHistory: ChatMessage[],
    onChunk?: (chunk: StreamingResponse) => void
  ): Promise<any> {
    try {
      // For now, use the non-streaming API and simulate streaming
      // This can be enhanced when Tambo SDK supports streaming
      const response = await this.callTamboAPI(systemPrompt, userPrompt, conversationHistory);
      
      // Simulate streaming by chunking the response
      if (onChunk && response.choices[0].message.content) {
        const content = response.choices[0].message.content;
        const words = content.split(' ');
        let accumulatedContent = '';
        
        for (let i = 0; i < words.length; i++) {
          accumulatedContent += (i > 0 ? ' ' : '') + words[i];
          
          onChunk({
            id: response.id,
            content: accumulatedContent,
            isComplete: i === words.length - 1,
            timestamp: new Date(),
            metadata: {
              chunkIndex: i,
              confidence: 0.9
            }
          });
          
          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      return response;
    } catch (error) {
      console.error('Tambo Streaming API Error:', error);
      throw new Error(`Tambo streaming API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private processAIResponse(response: any, context: LearningContext): AIResponse {
    const content = response.choices[0].message.content;
    const tokens = response.usage?.total_tokens || 0;

    // Generate adaptive actions based on content and context
    const adaptiveActions = this.generateAdaptiveActions(content, context);
    
    // Generate tutorial prompts
    const tutorialPrompts = this.generateTutorialPrompts(content, context);
    
    // Extract follow-up questions
    const followUpQuestions = this.extractFollowUpQuestions(content);
    
    // Generate suggestions
    const suggestions = this.generateSuggestions(content, context);

    return {
      id: uuidv4(),
      content,
      confidence: 0.9, // Base confidence, could be improved with actual model confidence
      sources: [], // Would be populated with actual sources if available
      suggestions,
      followUpQuestions,
      metadata: {
        model: this.config.model,
        tokens,
        processingTime: Date.now(), // Would be actual processing time
        temperature: this.config.temperature,
        context
      },
      adaptiveActions,
      tutorialPrompts,
      assessmentTrigger: this.shouldTriggerAssessment(content, context)
    };
  }

  private generateAdaptiveActions(content: string, context: LearningContext): AdaptiveAction[] {
    const actions: AdaptiveAction[] = [];

    // Check if difficulty should be adjusted
    if (content.includes('too easy') || content.includes('simple')) {
      actions.push({
        id: uuidv4(),
        type: 'difficulty_adjustment',
        action: 'increase_difficulty',
        reason: 'User indicates content is too easy',
        timestamp: new Date(),
        applied: false
      });
    }

    if (content.includes('too hard') || content.includes('difficult') || content.includes('confused')) {
      actions.push({
        id: uuidv4(),
        type: 'difficulty_adjustment',
        action: 'decrease_difficulty',
        reason: 'User indicates content is too difficult',
        timestamp: new Date(),
        applied: false
      });
    }

    // Check if explanation style should be adjusted
    if (context.learningStyle === LearningStyleType.VISUAL && !content.includes('diagram') && !content.includes('visual')) {
      actions.push({
        id: uuidv4(),
        type: 'explanation_style',
        action: 'add_visual_elements',
        reason: 'User prefers visual learning',
        timestamp: new Date(),
        applied: false
      });
    }

    return actions;
  }

  private generateTutorialPrompts(content: string, context: LearningContext): TutorialPrompt[] {
    const prompts: TutorialPrompt[] = [];

    // Generate practice prompts
    if (content.includes('practice') || content.includes('exercise')) {
      prompts.push({
        id: uuidv4(),
        title: 'Practice Exercise',
        description: 'Try a practice exercise to reinforce this concept',
        action: 'start_practice',
        priority: 'medium'
      });
    }

    // Generate assessment prompts
    if (content.includes('understand') || content.includes('concept')) {
      prompts.push({
        id: uuidv4(),
        title: 'Quick Assessment',
        description: 'Test your understanding with a quick quiz',
        action: 'start_assessment',
        priority: 'low'
      });
    }

    return prompts;
  }

  private extractFollowUpQuestions(content: string): string[] {
    const questions: string[] = [];
    
    // Simple pattern matching for follow-up questions
    const questionPatterns = [
      /What.*\?/g,
      /How.*\?/g,
      /Why.*\?/g,
      /When.*\?/g,
      /Where.*\?/g
    ];

    for (const pattern of questionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        questions.push(...matches.slice(0, 2)); // Limit to 2 questions per pattern
      }
    }

    return questions.slice(0, 5); // Limit total questions
  }

  private generateSuggestions(content: string, context: LearningContext): string[] {
    const suggestions: string[] = [];

    // Generate context-aware suggestions
    if (context.currentModule) {
      suggestions.push(`Continue with the next section in ${context.currentModule}`);
    }

    if (context.weaknesses && context.weaknesses.length > 0) {
      suggestions.push(`Review concepts in: ${context.weaknesses.join(', ')}`);
    }

    if (context.progress && context.progress.currentScore < 70) {
      suggestions.push('Consider additional practice exercises');
    }

    return suggestions;
  }

  private shouldTriggerAssessment(content: string, context: LearningContext): boolean {
    // Check if assessment should be triggered
    const assessmentTriggers = [
      'ready for assessment',
      'test your knowledge',
      'quiz',
      'evaluation',
      'check understanding'
    ];

    return assessmentTriggers.some(trigger => 
      content.toLowerCase().includes(trigger.toLowerCase())
    );
  }

  // Utility methods for learning-specific features
  async generateLearningStyleAdaptedResponse(
    message: string,
    context: LearningContext,
    targetStyle: LearningStyleType
  ): Promise<AIResponse> {
    const adaptedContext = { ...context, learningStyle: targetStyle };
    return this.generateResponse(message, adaptedContext);
  }

  async generateAssessmentQuestion(
    topic: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced',
    context: LearningContext
  ): Promise<AIResponse> {
    const assessmentPrompt = `Generate a ${difficulty} level assessment question about ${topic}. 
    The question should be appropriate for someone with ${context.learningStyle} learning style.
    Include multiple choice options if applicable, and provide an explanation for the correct answer.`;
    
    return this.generateResponse(assessmentPrompt, context);
  }

  async generateExplanation(
    concept: string,
    context: LearningContext,
    detailLevel: 'brief' | 'detailed' | 'comprehensive' = 'detailed'
  ): Promise<AIResponse> {
    const explanationPrompt = `Provide a ${detailLevel} explanation of ${concept}. 
    Adapt the explanation for someone with ${context.learningStyle} learning style at ${context.difficultyLevel} level.
    Use examples and analogies where appropriate.`;
    
    return this.generateResponse(explanationPrompt, context);
  }

  async generateHint(
    problem: string,
    context: LearningContext,
    hintLevel: 'subtle' | 'moderate' | 'explicit' = 'moderate'
  ): Promise<AIResponse> {
    const hintPrompt = `Provide a ${hintLevel} hint for this problem: ${problem}. 
    Don't give away the complete solution, but guide the learner toward the answer.
    Consider their learning style: ${context.learningStyle}.`;
    
    return this.generateResponse(hintPrompt, context);
  }

  async generateEncouragement(
    context: LearningContext,
    situation: 'struggling' | 'progressing' | 'achieved' = 'progressing'
  ): Promise<AIResponse> {
    const encouragementPrompt = `Provide encouraging feedback for a learner who is ${situation}. 
    They have completed ${context.progress?.completedModules.length || 0} modules and their current score is ${context.progress?.currentScore || 0}.
    Be specific and motivating while maintaining a growth mindset.`;
    
    return this.generateResponse(encouragementPrompt, context);
  }
}

// Singleton instance
export const aiService = new AIService();
export default aiService;