// Export all contexts and their hooks
export { AuthProvider, useAuth } from './AuthContext';
export { LearningProvider, useLearning } from './LearningContext';
export { QuizProvider, useQuiz } from './QuizContext';
export { ChatProvider, useChat } from './ChatContext';
export { NotificationProvider, useNotifications, withNotifications } from './NotificationContext';
export { SyncProvider, useSync, withSync } from './SyncContext';
export { UIProvider, useUI, withUI } from './UIContext';
export { 
  RootProvider, 
  EnhancedRootProvider, 
  FeatureProvider, 
  useAppState, 
  useContextsLoaded 
} from './RootProvider';

// Re-export the original AppProvider for backward compatibility
export { AppProvider, useApp } from './AppContext';