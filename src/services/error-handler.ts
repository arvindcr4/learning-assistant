import { LearningContext, AIResponse, ChatMessage } from '../types';

export interface ErrorHandlerConfig {
  maxRetries: number;
  retryDelay: number;
  fallbackEnabled: boolean;
  enableLogging: boolean;
}

export interface ErrorDetails {
  code: string;
  message: string;
  source: 'tambo_api' | 'audio_service' | 'network' | 'validation' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  userMessage: string;
  technicalDetails?: any;
}

export interface FallbackResponse {
  content: string;
  source: 'cached' | 'template' | 'offline' | 'static';
  confidence: number;
}

/**
 * Enhanced error handling and fallback service for the learning assistant
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private fallbackResponses: Map<string, FallbackResponse> = new Map();
  private errorHistory: ErrorDetails[] = [];

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      fallbackEnabled: true,
      enableLogging: true,
      ...config
    };

    this.initializeFallbackResponses();
  }

  /**
   * Initialize common fallback responses
   */
  private initializeFallbackResponses(): void {
    this.fallbackResponses.set('greeting', {
      content: "Hello! I'm your learning assistant. I'm here to help you with your studies. How can I assist you today?",
      source: 'static',
      confidence: 0.8
    });

    this.fallbackResponses.set('generic_help', {
      content: "I understand you need help with your learning. While I'm experiencing some technical difficulties, I can still assist you with basic questions about your studies. Please try rephrasing your question or ask about a specific topic.",
      source: 'static',
      confidence: 0.7
    });

    this.fallbackResponses.set('technical_error', {
      content: "I'm experiencing some technical difficulties right now. Don't worry - your learning progress is still being tracked. Please try again in a moment, or feel free to continue with your studies and return to our conversation later.",
      source: 'static',
      confidence: 0.6
    });

    this.fallbackResponses.set('connection_error', {
      content: "It seems there's a connection issue. Your learning data is saved locally, so nothing is lost. Try refreshing the page or checking your internet connection. I'll be here when you're ready to continue!",
      source: 'static',
      confidence: 0.6
    });

    this.fallbackResponses.set('rate_limit_error', {
      content: "I'm getting a lot of questions right now! Please wait a moment before asking another question. In the meantime, you can review your learning materials or try the practice exercises.",
      source: 'static',
      confidence: 0.8
    });

    this.fallbackResponses.set('audio_error', {
      content: "I'm having trouble with voice processing right now. You can still type your questions, and I'll respond normally. Voice features should be available again shortly.",
      source: 'static',
      confidence: 0.7
    });
  }

  /**
   * Handle errors with automatic retries and fallbacks
   */
  public async handleError<T>(
    operation: () => Promise<T>,
    context: LearningContext,
    errorType: string = 'generic'
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        const errorDetails = this.analyzeError(lastError, errorType);
        this.logError(errorDetails, attempt);

        // If not retryable or max attempts reached, handle the error
        if (!errorDetails.retryable || attempt === this.config.maxRetries) {
          throw this.createHandledError(errorDetails, context);
        }

        // Wait before retry
        await this.delay(this.config.retryDelay * attempt);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Analyze error and determine handling strategy
   */
  private analyzeError(error: Error, errorType: string): ErrorDetails {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return {
        code: 'NETWORK_ERROR',
        message: error.message,
        source: 'network',
        severity: 'medium',
        retryable: true,
        userMessage: 'Connection issue detected. Retrying...'
      };
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return {
        code: 'RATE_LIMIT_EXCEEDED',
        message: error.message,
        source: 'tambo_api',
        severity: 'medium',
        retryable: true,
        userMessage: 'Too many requests. Please wait a moment.'
      };
    }

    // Authentication errors
    if (message.includes('unauthorized') || message.includes('invalid key') || message.includes('forbidden')) {
      return {
        code: 'AUTH_ERROR',
        message: error.message,
        source: 'tambo_api',
        severity: 'high',
        retryable: false,
        userMessage: 'Authentication issue. Please contact support.'
      };
    }

    // Audio-specific errors
    if (message.includes('microphone') || message.includes('audio') || message.includes('speech')) {
      return {
        code: 'AUDIO_ERROR',
        message: error.message,
        source: 'audio_service',
        severity: 'low',
        retryable: true,
        userMessage: 'Audio feature temporarily unavailable.'
      };
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid input') || message.includes('sanitization')) {
      return {
        code: 'VALIDATION_ERROR',
        message: error.message,
        source: 'validation',
        severity: 'medium',
        retryable: false,
        userMessage: 'Please check your input and try again.'
      };
    }

    // Generic API errors
    if (message.includes('api') || message.includes('server') || message.includes('service')) {
      return {
        code: 'API_ERROR',
        message: error.message,
        source: 'tambo_api',
        severity: 'medium',
        retryable: true,
        userMessage: 'Service temporarily unavailable. Retrying...'
      };
    }

    // Unknown errors
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      source: 'unknown',
      severity: 'medium',
      retryable: true,
      userMessage: 'An unexpected error occurred. Retrying...',
      technicalDetails: error
    };
  }

  /**
   * Create a handled error with fallback response
   */
  private createHandledError(errorDetails: ErrorDetails, context: LearningContext): Error {
    // Add to error history
    this.errorHistory.push({
      ...errorDetails,
      message: errorDetails.message
    });

    // Create enhanced error with fallback
    const handledError = new Error(errorDetails.userMessage);
    (handledError as any).errorDetails = errorDetails;
    (handledError as any).fallbackResponse = this.getFallbackResponse(errorDetails, context);
    
    return handledError;
  }

  /**
   * Get appropriate fallback response
   */
  public getFallbackResponse(errorDetails: ErrorDetails, context: LearningContext): FallbackResponse {
    if (!this.config.fallbackEnabled) {
      return {
        content: "I'm sorry, but I'm unable to respond right now. Please try again later.",
        source: 'static',
        confidence: 0.5
      };
    }

    // Choose fallback based on error type
    let fallbackKey: string;
    
    switch (errorDetails.code) {
      case 'NETWORK_ERROR':
        fallbackKey = 'connection_error';
        break;
      case 'RATE_LIMIT_EXCEEDED':
        fallbackKey = 'rate_limit_error';
        break;
      case 'AUDIO_ERROR':
        fallbackKey = 'audio_error';
        break;
      case 'AUTH_ERROR':
        fallbackKey = 'technical_error';
        break;
      default:
        fallbackKey = 'generic_help';
    }

    const fallback = this.fallbackResponses.get(fallbackKey) || this.fallbackResponses.get('generic_help')!;
    
    // Customize fallback based on context
    return this.customizeFallbackResponse(fallback, context);
  }

  /**
   * Customize fallback response based on learning context
   */
  private customizeFallbackResponse(fallback: FallbackResponse, context: LearningContext): FallbackResponse {
    let customizedContent = fallback.content;

    // Add context-specific suggestions
    if (context.currentModule) {
      customizedContent += ` You were working on "${context.currentModule}". You can continue with your studies or try asking a simpler question about this topic.`;
    }

    if (context.learningStyle) {
      const styleHints = {
        visual: "Try using diagrams or visual aids to help with your learning.",
        auditory: "Consider listening to audio materials or discussing concepts aloud.",
        kinesthetic: "Try hands-on activities or practice exercises.",
        reading: "Review written materials or take notes to reinforce your learning."
      };
      
      const hint = styleHints[context.learningStyle as keyof typeof styleHints];
      if (hint) {
        customizedContent += ` ${hint}`;
      }
    }

    return {
      ...fallback,
      content: customizedContent
    };
  }

  /**
   * Generate fallback AI response
   */
  public generateFallbackAIResponse(error: Error, context: LearningContext): AIResponse {
    const errorDetails = (error as any).errorDetails as ErrorDetails;
    const fallbackResponse = (error as any).fallbackResponse as FallbackResponse || 
                             this.getFallbackResponse(errorDetails || this.createDefaultErrorDetails(), context);

    return {
      id: `fallback_${Date.now()}`,
      content: fallbackResponse.content,
      confidence: fallbackResponse.confidence,
      sources: [],
      suggestions: this.generateFallbackSuggestions(errorDetails, context),
      followUpQuestions: [],
      metadata: {
        model: 'fallback',
        tokens: fallbackResponse.content.length / 4,
        processingTime: 0,
        temperature: 0,
        context,
        isFallback: true,
        errorCode: errorDetails?.code || 'UNKNOWN'
      },
      adaptiveActions: [],
      tutorialPrompts: [],
      assessmentTrigger: false
    };
  }

  /**
   * Generate helpful suggestions for error scenarios
   */
  private generateFallbackSuggestions(errorDetails: ErrorDetails | undefined, context: LearningContext): string[] {
    const suggestions: string[] = [];

    if (errorDetails?.code === 'NETWORK_ERROR') {
      suggestions.push('Check your internet connection');
      suggestions.push('Try refreshing the page');
      suggestions.push('Switch to offline study materials');
    } else if (errorDetails?.code === 'RATE_LIMIT_EXCEEDED') {
      suggestions.push('Wait a moment before asking another question');
      suggestions.push('Review your previous answers');
      suggestions.push('Try practice exercises');
    } else {
      suggestions.push('Try rephrasing your question');
      suggestions.push('Ask about a specific topic');
      suggestions.push('Continue with your current lesson');
    }

    if (context.currentModule) {
      suggestions.push(`Review materials for ${context.currentModule}`);
    }

    return suggestions;
  }

  /**
   * Create default error details for unknown errors
   */
  private createDefaultErrorDetails(): ErrorDetails {
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      source: 'unknown',
      severity: 'medium',
      retryable: false,
      userMessage: 'Something went wrong. Please try again.'
    };
  }

  /**
   * Log error for monitoring and debugging
   */
  private logError(errorDetails: ErrorDetails, attempt: number): void {
    if (!this.config.enableLogging) return;

    const logData = {
      timestamp: new Date().toISOString(),
      error: errorDetails,
      attempt,
      maxAttempts: this.config.maxRetries
    };

    // In production, this would send to a logging service
    console.error('Learning Assistant Error:', logData);

    // Store in error history (limit to last 100 errors)
    this.errorHistory.push(errorDetails);
    if (this.errorHistory.length > 100) {
      this.errorHistory = this.errorHistory.slice(-100);
    }
  }

  /**
   * Get error statistics for monitoring
   */
  public getErrorStats(): {
    totalErrors: number;
    errorsBySource: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentErrors: ErrorDetails[];
  } {
    const errorsBySource: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    this.errorHistory.forEach(error => {
      errorsBySource[error.source] = (errorsBySource[error.source] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });

    return {
      totalErrors: this.errorHistory.length,
      errorsBySource,
      errorsBySeverity,
      recentErrors: this.errorHistory.slice(-10)
    };
  }

  /**
   * Clear error history
   */
  public clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Add custom fallback response
   */
  public addFallbackResponse(key: string, response: FallbackResponse): void {
    this.fallbackResponses.set(key, response);
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if an error has a fallback response available
   */
  public hasFallbackResponse(error: Error): boolean {
    return !!(error as any).fallbackResponse;
  }

  /**
   * Extract fallback response from error
   */
  public extractFallbackResponse(error: Error): FallbackResponse | null {
    return (error as any).fallbackResponse || null;
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();
export default errorHandler;