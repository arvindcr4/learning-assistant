import axios, { AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
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

export class AIService {
  private config: AIConfig;
  private defaultPersona: AIPersona;

  constructor() {
    this.config = this.loadConfig();
    this.defaultPersona = this.createDefaultPersona();
  }

  private loadConfig(): AIConfig {
    return {
      apiKey: process.env.TAMBO_AI_API_KEY || '',
      baseUrl: process.env.TAMBO_AI_BASE_URL || 'https://api.tambo.ai',
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
    try {
      const systemPrompt = this.buildSystemPrompt(persona || this.defaultPersona, context);
      const userPrompt = this.buildUserPrompt(message, context);
      
      const response = await this.callTamboAPI(systemPrompt, userPrompt, conversationHistory);
      
      return this.processAIResponse(response, context);
    } catch (error) {
      console.error('AI Service Error:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  async generateStreamingResponse(
    message: string,
    context: LearningContext,
    conversationHistory: ChatMessage[] = [],
    persona?: AIPersona,
    onChunk?: (chunk: StreamingResponse) => void
  ): Promise<AIResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(persona || this.defaultPersona, context);
      const userPrompt = this.buildUserPrompt(message, context);
      
      const response = await this.callTamboStreamingAPI(
        systemPrompt, 
        userPrompt, 
        conversationHistory, 
        onChunk
      );
      
      return this.processAIResponse(response, context);
    } catch (error) {
      console.error('AI Streaming Service Error:', error);
      throw new Error('Failed to generate streaming AI response');
    }
  }

  private buildSystemPrompt(persona: AIPersona, context: LearningContext): string {
    const basePrompt = `You are ${persona.name}, a ${persona.type} with expertise in ${persona.expertise.join(', ')}.

Personality: ${persona.personality}

Communication Style: ${persona.communicationStyle}

Current Learning Context:
- User ID: ${context.userId}
- Current Module: ${context.currentModule || 'None'}
- Learning Path: ${context.currentPath || 'None'}
- Learning Style: ${context.learningStyle || 'Not determined'}
- Difficulty Level: ${context.difficultyLevel || 'Not set'}
- Progress: ${context.progress ? `${context.progress.completedModules.length} modules completed, current score: ${context.progress.currentScore}` : 'No progress data'}

Recent Context:
- Strengths: ${context.strengths?.join(', ') || 'None identified'}
- Weaknesses: ${context.weaknesses?.join(', ') || 'None identified'}
- Recent Mistakes: ${context.recentMistakes?.join(', ') || 'None recorded'}

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
    const contextualPrompt = `Current learning context: ${context.currentModule || 'General discussion'}

User message: ${message}

Please respond in a way that:
1. Addresses the user's specific question or need
2. Considers their learning style (${context.learningStyle || 'unknown'})
3. Matches their difficulty level (${context.difficultyLevel || 'unknown'})
4. Builds upon their current progress
5. Provides appropriate educational support

If this appears to be a question about a specific concept, provide:
- A clear, tailored explanation
- Relevant examples
- Follow-up questions to check understanding
- Suggestions for practice or further learning

If the user seems confused or frustrated, provide:
- Encouragement and support
- Simpler explanations
- Different approaches to the same concept
- Offer to break down the problem into smaller parts`;

    return contextualPrompt;
  }

  private async callTamboAPI(
    systemPrompt: string,
    userPrompt: string,
    conversationHistory: ChatMessage[]
  ): Promise<any> {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: userPrompt }
    ];

    const response: AxiosResponse = await axios.post(
      `${this.config.baseUrl}/chat/completions`,
      {
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  private async callTamboStreamingAPI(
    systemPrompt: string,
    userPrompt: string,
    conversationHistory: ChatMessage[],
    onChunk?: (chunk: StreamingResponse) => void
  ): Promise<any> {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: userPrompt }
    ];

    const response: AxiosResponse = await axios.post(
      `${this.config.baseUrl}/chat/completions`,
      {
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: true
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }
    );

    let fullContent = '';
    let chunkIndex = 0;
    const responseId = uuidv4();

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk: any) => {
        try {
          const chunkStr = chunk.toString();
          const lines = chunkStr.split('\n').filter((line: string) => line.trim() !== '');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                resolve({
                  id: responseId,
                  choices: [{ message: { content: fullContent } }],
                  usage: { total_tokens: fullContent.length / 4 } // Rough estimate
                });
                return;
              }
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.choices && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                  const content = parsed.choices[0].delta.content;
                  fullContent += content;
                  
                  if (onChunk) {
                    onChunk({
                      id: responseId,
                      content: fullContent,
                      isComplete: false,
                      timestamp: new Date(),
                      metadata: {
                        chunkIndex: chunkIndex++,
                        confidence: 0.9
                      }
                    });
                  }
                }
              } catch (parseError) {
                console.warn('Failed to parse chunk:', data);
              }
            }
          }
        } catch (error) {
          console.error('Error processing chunk:', error);
        }
      });

      response.data.on('end', () => {
        resolve({
          id: responseId,
          choices: [{ message: { content: fullContent } }],
          usage: { total_tokens: fullContent.length / 4 }
        });
      });

      response.data.on('error', (error: any) => {
        reject(error);
      });
    });
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