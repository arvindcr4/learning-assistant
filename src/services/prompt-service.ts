import { 
  LearningPrompt, 
  LearningContext, 
  LearningStyleType, 
  PromptVariable,
  AIPersona,
  ConversationState
} from '../types';
import { 
  LEARNING_PROMPTS, 
  LEARNING_STYLE_ADAPTATIONS, 
  DIFFICULTY_ADAPTATIONS,
  AI_RESPONSE_TEMPLATES 
} from '../lib/ai-config';

export class PromptService {
  private prompts: Map<string, LearningPrompt> = new Map();
  private customPrompts: Map<string, LearningPrompt> = new Map();

  constructor() {
    this.loadDefaultPrompts();
  }

  private loadDefaultPrompts(): void {
    // Load all default prompts from config
    Object.values(LEARNING_PROMPTS).flat().forEach(prompt => {
      this.prompts.set(prompt.id, prompt);
    });
  }

  // Core Prompt Generation
  generateContextualPrompt(
    category: LearningPrompt['category'],
    context: LearningContext,
    variables: Record<string, any> = {},
    persona?: AIPersona
  ): string {
    const prompt = this.selectBestPrompt(category, context);
    if (!prompt) {
      return this.generateFallbackPrompt(category, context, variables);
    }

    return this.renderPrompt(prompt, context, variables, persona);
  }

  generateAdaptivePrompt(
    basePrompt: string,
    context: LearningContext,
    conversationState: ConversationState,
    persona?: AIPersona
  ): string {
    let adaptedPrompt = basePrompt;

    // Apply learning style adaptations
    if (context.learningStyle) {
      adaptedPrompt = this.applyLearningStyleAdaptation(adaptedPrompt, context.learningStyle);
    }

    // Apply difficulty adaptations
    if (context.difficultyLevel) {
      adaptedPrompt = this.applyDifficultyAdaptation(adaptedPrompt, context.difficultyLevel);
    }

    // Apply conversation state adaptations
    adaptedPrompt = this.applyConversationStateAdaptation(adaptedPrompt, conversationState);

    // Apply persona adaptations
    if (persona) {
      adaptedPrompt = this.applyPersonaAdaptation(adaptedPrompt, persona);
    }

    return adaptedPrompt;
  }

  // Specific Prompt Generators
  generateAssessmentPrompt(
    topic: string,
    context: LearningContext,
    assessmentType: 'formative' | 'summative' | 'diagnostic' = 'formative'
  ): string {
    const variables = {
      topic,
      assessmentType,
      difficulty: context.difficultyLevel || 'intermediate',
      learningStyle: context.learningStyle || 'visual'
    };

    const basePrompt = this.generateContextualPrompt('assessment', context, variables);
    
    // Add specific assessment instructions
    const assessmentInstructions = this.getAssessmentInstructions(assessmentType, context);
    
    return `${basePrompt}\n\n${assessmentInstructions}`;
  }

  generateExplanationPrompt(
    concept: string,
    context: LearningContext,
    detailLevel: 'brief' | 'detailed' | 'comprehensive' = 'detailed',
    includeExamples: boolean = true
  ): string {
    const variables = {
      concept,
      detailLevel,
      includeExamples,
      learningStyle: context.learningStyle || 'visual',
      currentKnowledge: context.progress?.currentScore || 0
    };

    const basePrompt = this.generateContextualPrompt('explanation', context, variables);
    
    // Add style-specific instructions
    const styleInstructions = this.getStyleSpecificInstructions(context.learningStyle);
    
    return `${basePrompt}\n\n${styleInstructions}`;
  }

  generateEncouragementPrompt(
    context: LearningContext,
    situation: 'struggling' | 'progressing' | 'achieved' = 'progressing',
    specificAchievement?: string
  ): string {
    const variables = {
      situation,
      achievement: specificAchievement || 'your recent progress',
      currentScore: context.progress?.currentScore || 0,
      completedModules: context.progress?.completedModules?.length || 0,
      timeSpent: context.progress?.timeSpent || 0
    };

    return this.generateContextualPrompt('encouragement', context, variables);
  }

  generateCorrectionPrompt(
    incorrectAnswer: string,
    correctConcept: string,
    context: LearningContext,
    explanationLevel: 'gentle' | 'detailed' | 'comprehensive' = 'gentle'
  ): string {
    const variables = {
      incorrectAnswer,
      correctConcept,
      explanationLevel,
      learningStyle: context.learningStyle || 'visual',
      encouragementLevel: 'moderate'
    };

    return this.generateContextualPrompt('correction', context, variables);
  }

  generateGuidancePrompt(
    problem: string,
    context: LearningContext,
    guidanceType: 'socratic' | 'hints' | 'scaffolding' = 'socratic'
  ): string {
    const variables = {
      problem,
      guidanceType,
      learningStyle: context.learningStyle || 'visual',
      difficulty: context.difficultyLevel || 'intermediate'
    };

    return this.generateContextualPrompt('guidance', context, variables);
  }

  // Specialized Prompts
  generateSocraticQuestionPrompt(
    topic: string,
    context: LearningContext,
    questionDepth: 'surface' | 'analytical' | 'synthesis' = 'analytical'
  ): string {
    const depthInstructions = {
      surface: 'Ask questions that help recall and understand basic facts about',
      analytical: 'Ask questions that help analyze and break down the components of',
      synthesis: 'Ask questions that help synthesize and apply knowledge about'
    };

    return `You are using the Socratic method to guide learning. ${depthInstructions[questionDepth]} ${topic}.

Learning Context:
- Student's learning style: ${context.learningStyle || 'Not determined'}
- Current difficulty level: ${context.difficultyLevel || 'Not set'}
- Recent progress: ${context.progress?.currentScore || 0}% completion

Instructions:
1. Ask one thoughtful question at a time
2. Build on previous responses
3. Guide discovery rather than providing answers
4. Adapt your questioning style to their learning preferences
5. Be patient and encouraging

Question about ${topic}:`;
  }

  generateScenarioBasedPrompt(
    concept: string,
    context: LearningContext,
    scenarioType: 'real_world' | 'hypothetical' | 'case_study' = 'real_world'
  ): string {
    const scenarios = {
      real_world: 'Create a real-world scenario where',
      hypothetical: 'Imagine a hypothetical situation where',
      case_study: 'Present a case study that demonstrates how'
    };

    return `${scenarios[scenarioType]} ${concept} is applied or relevant.

Adapt this scenario for someone who:
- Learns best through ${context.learningStyle || 'visual'} methods
- Is at a ${context.difficultyLevel || 'intermediate'} level
- Has completed ${context.progress?.completedModules?.length || 0} related modules

Make the scenario engaging, relevant, and educational. Include:
1. Clear context and background
2. The role of ${concept} in the scenario
3. Questions for reflection or application
4. Connection to their learning goals`;
  }

  generateMetacognitionPrompt(
    context: LearningContext,
    reflectionType: 'progress' | 'strategy' | 'understanding' = 'progress'
  ): string {
    const reflectionPrompts = {
      progress: 'How do you feel about your learning progress so far?',
      strategy: 'What learning strategies have been working best for you?',
      understanding: 'What concepts are you finding most challenging to understand?'
    };

    return `Let's take a moment for reflection. I'd like to help you think about your learning process.

${reflectionPrompts[reflectionType]}

Based on your response, I'll help you:
1. Identify what's working well
2. Recognize areas for improvement
3. Adjust our approach if needed
4. Set goals for continued learning

Your current progress shows:
- ${context.progress?.completedModules?.length || 0} modules completed
- ${context.progress?.currentScore || 0}% average score
- ${context.progress?.timeSpent || 0} minutes of study time

Take your time to reflect, and share whatever feels relevant to you.`;
  }

  // Prompt Adaptation Methods
  private applyLearningStyleAdaptation(prompt: string, style: LearningStyleType): string {
    const adaptations = LEARNING_STYLE_ADAPTATIONS[style];
    if (!adaptations) return prompt;

    // Add style-specific language and techniques
    const styleAddition = `\nAdaptation for ${style} learner:
- Use language like: ${adaptations.language.join(', ')}
- Incorporate: ${adaptations.preferences.join(', ')}
- Apply techniques: ${adaptations.techniques.join(', ')}`;

    return prompt + styleAddition;
  }

  private applyDifficultyAdaptation(prompt: string, difficulty: 'beginner' | 'intermediate' | 'advanced'): string {
    const adaptations = DIFFICULTY_ADAPTATIONS[difficulty];
    if (!adaptations) return prompt;

    const difficultyAddition = `\nDifficulty level: ${difficulty}
- Characteristics: ${adaptations.characteristics.join(', ')}
- Maximum concepts per response: ${adaptations.maxConcepts}
- Example ratio: ${adaptations.exampleRatio} examples per concept
- Complexity level: ${adaptations.complexityLevel}/3`;

    return prompt + difficultyAddition;
  }

  private applyConversationStateAdaptation(prompt: string, state: ConversationState): string {
    let adaptations = '';

    if (state.frustrationLevel > 50) {
      adaptations += '\nNote: Student showing signs of frustration. Be extra encouraging and break down concepts more simply.';
    }

    if (state.understandingLevel < 30) {
      adaptations += '\nNote: Student struggling with understanding. Provide more detailed explanations and examples.';
    }

    if (state.engagementLevel < 40) {
      adaptations += '\nNote: Student engagement is low. Use more interactive and interesting approaches.';
    }

    if (state.needsHelp) {
      adaptations += '\nNote: Student has requested help. Provide clear, supportive guidance.';
    }

    return prompt + adaptations;
  }

  private applyPersonaAdaptation(prompt: string, persona: AIPersona): string {
    const personaAddition = `\nPersona: ${persona.name} (${persona.type})
- Communication style: ${persona.communicationStyle}
- Expertise areas: ${persona.expertise.slice(0, 3).join(', ')}
- Adaptive level: ${persona.adaptiveLevel}/10
- Personality note: ${persona.personality}`;

    return prompt + personaAddition;
  }

  // Helper Methods
  private selectBestPrompt(category: LearningPrompt['category'], context: LearningContext): LearningPrompt | null {
    const categoryPrompts = Array.from(this.prompts.values()).filter(p => p.category === category);
    
    if (categoryPrompts.length === 0) return null;

    // Score prompts based on context match
    const scoredPrompts = categoryPrompts.map(prompt => ({
      prompt,
      score: this.scorePromptMatch(prompt, context)
    }));

    // Sort by score and return the best match
    scoredPrompts.sort((a, b) => b.score - a.score);
    const bestMatch = scoredPrompts[0];
    if (!bestMatch) {
      throw new Error('No suitable prompt found for the given context');
    }
    return bestMatch.prompt;
  }

  private scorePromptMatch(prompt: LearningPrompt, context: LearningContext): number {
    let score = 0;

    // Learning style match
    if (prompt.learningStyle === context.learningStyle) score += 30;

    // Difficulty match
    if (prompt.difficulty === context.difficultyLevel) score += 20;

    // Effectiveness score
    score += prompt.effectiveness * 0.5;

    return score;
  }

  private renderPrompt(
    prompt: LearningPrompt,
    context: LearningContext,
    variables: Record<string, any>,
    persona?: AIPersona
  ): string {
    let renderedPrompt = prompt.template;

    // Replace template variables
    prompt.variables.forEach(variable => {
      const value = variables[variable.name] || variable.value || '';
      const placeholder = `{{${variable.name}}}`;
      renderedPrompt = renderedPrompt.replace(new RegExp(placeholder, 'g'), String(value));
    });

    // Add context information
    const contextInfo = this.buildContextString(context);
    renderedPrompt += `\n\nContext: ${contextInfo}`;

    return renderedPrompt;
  }

  private buildContextString(context: LearningContext): string {
    const parts = [];
    
    if (context.currentModule) parts.push(`Module: ${context.currentModule}`);
    if (context.currentPath) parts.push(`Path: ${context.currentPath}`);
    if (context.learningStyle) parts.push(`Style: ${context.learningStyle}`);
    if (context.difficultyLevel) parts.push(`Level: ${context.difficultyLevel}`);
    if (context.progress?.currentScore) parts.push(`Score: ${context.progress.currentScore}%`);
    
    return parts.join(', ');
  }

  private generateFallbackPrompt(
    category: LearningPrompt['category'],
    context: LearningContext,
    variables: Record<string, any>
  ): string {
    const fallbackTemplates = {
      assessment: 'Please assess the student\'s understanding of {{topic}}. Ask a question appropriate for their {{difficulty}} level.',
      explanation: 'Please explain {{concept}} in a way that\'s suitable for a {{learningStyle}} learner at {{difficulty}} level.',
      encouragement: 'Provide encouraging feedback for a student who is {{situation}} in their learning journey.',
      correction: 'Gently correct the student\'s understanding and provide the correct information about {{concept}}.',
      guidance: 'Guide the student through {{problem}} using {{guidanceType}} approach.'
    };

    let template = fallbackTemplates[category] || 'Please help the student with their learning.';
    
    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
      template = template.replace(`{{${key}}}`, String(value));
    });

    return template;
  }

  private getAssessmentInstructions(
    type: 'formative' | 'summative' | 'diagnostic',
    context: LearningContext
  ): string {
    const instructions = {
      formative: 'Provide immediate feedback and focus on understanding rather than grading.',
      summative: 'Evaluate overall mastery and provide a comprehensive assessment.',
      diagnostic: 'Identify specific knowledge gaps and areas that need attention.'
    };

    return `Assessment Type: ${type}\nInstructions: ${instructions[type]}\nAdapt for ${context.learningStyle || 'general'} learning style.`;
  }

  private getStyleSpecificInstructions(style?: LearningStyleType): string {
    if (!style) return '';

    const instructions = {
      [LearningStyleType.VISUAL]: 'Use visual metaphors, describe mental images, and reference diagrams or charts.',
      [LearningStyleType.AUDITORY]: 'Use verbal explanations, include discussions, and provide auditory cues.',
      [LearningStyleType.READING]: 'Provide written examples, use lists and definitions, and encourage note-taking.',
      [LearningStyleType.KINESTHETIC]: 'Include practical examples, hands-on activities, and real-world applications.'
    };

    return `Style-specific approach: ${instructions[style]}`;
  }

  // Custom Prompt Management
  addCustomPrompt(prompt: LearningPrompt): void {
    this.customPrompts.set(prompt.id, prompt);
  }

  removeCustomPrompt(promptId: string): boolean {
    return this.customPrompts.delete(promptId);
  }

  getCustomPrompts(): LearningPrompt[] {
    return Array.from(this.customPrompts.values());
  }

  // Template Utilities
  validateTemplate(template: string): boolean {
    // Check for balanced template variables
    const openBraces = (template.match(/{{/g) || []).length;
    const closeBraces = (template.match(/}}/g) || []).length;
    return openBraces === closeBraces;
  }

  extractTemplateVariables(template: string): string[] {
    const matches = template.match(/{{([^}]+)}}/g) || [];
    return matches.map(match => match.slice(2, -2).trim());
  }
}

// Singleton instance
export const promptService = new PromptService();
export default promptService;