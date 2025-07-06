// AI Chat System Components
export { default as ChatInterface } from './ChatInterface';
export { default as ChatSettings } from './ChatSettings';
export { default as ChatHistory } from './ChatHistory';
export { default as TutoringAssistant } from './TutoringAssistant';

// Re-export types for convenience
export type {
  ChatMessage,
  ChatSession,
  LearningContext,
  AIResponse,
  StreamingResponse,
  TutoringSession,
  TutoringProgress,
  ConversationState,
  ChatSettings as ChatSettingsType,
  AIPersona
} from '../../../types';

// Re-export services
export { aiService } from '../../../services/ai-service';
export { conversationService } from '../../../services/conversation-service';
export { promptService } from '../../../services/prompt-service';
export { chatStorage } from '../../../services/chat-storage';
export { learningProgressIntegration } from '../../../services/learning-progress-integration';

// Re-export configuration
export {
  AI_PERSONAS,
  LEARNING_PROMPTS,
  CONVERSATION_STYLES,
  DEFAULT_AI_SETTINGS
} from '../../../lib/ai-config';