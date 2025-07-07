import { z } from 'zod';

// Environment validation schema
const LingoConfigSchema = z.object({
  LINGO_DEV_API_KEY: z.string().min(1, 'Lingo.dev API key is required'),
});

// Configuration validation
const validateLingoConfig = () => {
  const result = LingoConfigSchema.safeParse({
    LINGO_DEV_API_KEY: process.env.LINGO_DEV_API_KEY,
  });
  
  if (!result.success) {
    throw new Error(`Lingo.dev configuration error: ${result.error.message}`);
  }
  
  return result.data;
};

// Lingo.dev API response types
export interface LingoTranslationResponse {
  success: boolean;
  data?: {
    translation: string;
    confidence: number;
    sourceLanguage: string;
    targetLanguage: string;
    metadata?: {
      context?: string;
      culturalAdaptation?: string;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

export interface LingoTranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
  culturalAdaptation?: boolean;
  quality?: 'standard' | 'high' | 'premium';
}

export interface LingoBatchTranslationRequest {
  texts: string[];
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
  culturalAdaptation?: boolean;
  quality?: 'standard' | 'high' | 'premium';
}

export interface LingoLanguageDetectionResponse {
  success: boolean;
  data?: {
    language: string;
    confidence: number;
    alternatives: Array<{
      language: string;
      confidence: number;
    }>;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface LingoSupportedLanguagesResponse {
  success: boolean;
  data?: {
    languages: Array<{
      code: string;
      name: string;
      nativeName: string;
      rtl: boolean;
      culturalAdaptationSupported: boolean;
    }>;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface LingoTranslationUsageResponse {
  success: boolean;
  data?: {
    charactersUsed: number;
    charactersLimit: number;
    resetDate: string;
    rateLimit: {
      requestsPerMinute: number;
      requestsRemaining: number;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

// Rate limiting configuration
interface RateLimitConfig {
  requestsPerMinute: number;
  requestsRemaining: number;
  resetTime: number;
}

export class LingoService {
  private static instance: LingoService;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.lingo.dev/v1';
  private rateLimitConfig: RateLimitConfig | null = null;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;

  private constructor() {
    const config = validateLingoConfig();
    this.apiKey = config.LINGO_DEV_API_KEY;
  }

  public static getInstance(): LingoService {
    if (!LingoService.instance) {
      LingoService.instance = new LingoService();
    }
    return LingoService.instance;
  }

  /**
   * Translate text using Lingo.dev API
   */
  public async translateText(request: LingoTranslationRequest): Promise<LingoTranslationResponse> {
    try {
      const response = await this.makeRequest('/translate', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: {
            code: errorData.code || 'TRANSLATION_ERROR',
            message: errorData.message || 'Failed to translate text',
            details: errorData.details,
          },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          translation: data.translation,
          confidence: data.confidence || 0.95,
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage,
          metadata: data.metadata,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred during translation',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Batch translate multiple texts
   */
  public async batchTranslate(request: LingoBatchTranslationRequest): Promise<LingoTranslationResponse[]> {
    try {
      const response = await this.makeRequest('/translate/batch', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Return error for all texts
        return request.texts.map(() => ({
          success: false,
          error: {
            code: errorData.code || 'BATCH_TRANSLATION_ERROR',
            message: errorData.message || 'Failed to batch translate texts',
            details: errorData.details,
          },
        }));
      }

      const data = await response.json();
      return data.translations.map((translation: any, index: number) => ({
        success: true,
        data: {
          translation: translation.text,
          confidence: translation.confidence || 0.95,
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage,
          metadata: translation.metadata,
        },
      }));
    } catch (error) {
      return request.texts.map(() => ({
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred during batch translation',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      }));
    }
  }

  /**
   * Detect language of text
   */
  public async detectLanguage(text: string): Promise<LingoLanguageDetectionResponse> {
    try {
      const response = await this.makeRequest('/detect', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: {
            code: errorData.code || 'DETECTION_ERROR',
            message: errorData.message || 'Failed to detect language',
          },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          language: data.language,
          confidence: data.confidence,
          alternatives: data.alternatives || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred during language detection',
        },
      };
    }
  }

  /**
   * Get supported languages
   */
  public async getSupportedLanguages(): Promise<LingoSupportedLanguagesResponse> {
    try {
      const response = await this.makeRequest('/languages', {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: {
            code: errorData.code || 'LANGUAGES_ERROR',
            message: errorData.message || 'Failed to get supported languages',
          },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          languages: data.languages,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred while fetching supported languages',
        },
      };
    }
  }

  /**
   * Get translation usage statistics
   */
  public async getUsageStats(): Promise<LingoTranslationUsageResponse> {
    try {
      const response = await this.makeRequest('/usage', {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: {
            code: errorData.code || 'USAGE_ERROR',
            message: errorData.message || 'Failed to get usage statistics',
          },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          charactersUsed: data.charactersUsed,
          charactersLimit: data.charactersLimit,
          resetDate: data.resetDate,
          rateLimit: data.rateLimit,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred while fetching usage statistics',
        },
      };
    }
  }

  /**
   * Check service health
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/health', {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Make authenticated request to Lingo.dev API
   */
  private async makeRequest(endpoint: string, options: RequestInit): Promise<Response> {
    // Check rate limits
    if (this.rateLimitConfig && this.rateLimitConfig.requestsRemaining <= 0) {
      const now = Date.now();
      if (now < this.rateLimitConfig.resetTime) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': 'learning-assistant/1.0.0',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Update rate limit info from response headers
    this.updateRateLimitInfo(response);

    return response;
  }

  /**
   * Update rate limit configuration from response headers
   */
  private updateRateLimitInfo(response: Response): void {
    const requestsPerMinute = response.headers.get('X-RateLimit-Limit');
    const requestsRemaining = response.headers.get('X-RateLimit-Remaining');
    const resetTime = response.headers.get('X-RateLimit-Reset');

    if (requestsPerMinute && requestsRemaining && resetTime) {
      this.rateLimitConfig = {
        requestsPerMinute: parseInt(requestsPerMinute),
        requestsRemaining: parseInt(requestsRemaining),
        resetTime: parseInt(resetTime) * 1000, // Convert to milliseconds
      };
    }
  }

  /**
   * Get rate limit information
   */
  public getRateLimitInfo(): RateLimitConfig | null {
    return this.rateLimitConfig;
  }

  /**
   * Test API connection and configuration
   */
  public async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      // Test with a simple health check
      const healthOk = await this.healthCheck();
      
      if (!healthOk) {
        return {
          success: false,
          message: 'Lingo.dev API is not responding',
        };
      }

      // Test with a simple translation
      const testTranslation = await this.translateText({
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        quality: 'standard',
      });

      if (!testTranslation.success) {
        return {
          success: false,
          message: 'Translation test failed',
          details: testTranslation.error,
        };
      }

      // Get usage stats
      const usageStats = await this.getUsageStats();

      return {
        success: true,
        message: 'Lingo.dev API connection successful',
        details: {
          testTranslation: testTranslation.data,
          usageStats: usageStats.data,
          rateLimitInfo: this.rateLimitConfig,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Connection test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const lingoService = LingoService.getInstance();

// Helper functions for common operations
export const translateWithFallback = async (
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  fallbackText?: string
): Promise<string> => {
  try {
    const result = await lingoService.translateText({
      text,
      sourceLanguage,
      targetLanguage,
      culturalAdaptation: true,
      quality: 'high',
    });

    if (result.success && result.data) {
      return result.data.translation;
    }

    // Fall back to provided fallback or original text
    return fallbackText || text;
  } catch (error) {
    console.error('Translation error:', error);
    return fallbackText || text;
  }
};

export const batchTranslateWithFallback = async (
  texts: string[],
  sourceLanguage: string,
  targetLanguage: string,
  fallbackTexts?: string[]
): Promise<string[]> => {
  try {
    const results = await lingoService.batchTranslate({
      texts,
      sourceLanguage,
      targetLanguage,
      culturalAdaptation: true,
      quality: 'high',
    });

    return results.map((result, index) => {
      if (result.success && result.data) {
        return result.data.translation;
      }
      return fallbackTexts?.[index] || texts[index];
    });
  } catch (error) {
    console.error('Batch translation error:', error);
    return fallbackTexts || texts;
  }
};