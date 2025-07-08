'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';

import type { ChatState, ChatAction, ChatMessage, ChatContext as ChatContextType } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';

// Initial state
const initialState: ChatState = {
  messages: [],
  isLoading: false,
  error: null,
  conversationId: null,
  context: null,
  suggestions: [],
};

// Reducer function
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'SET_CONVERSATION_ID':
      return {
        ...state,
        conversationId: action.payload,
      };

    case 'SET_CONTEXT':
      return {
        ...state,
        context: action.payload,
      };

    case 'SET_SUGGESTIONS':
      return {
        ...state,
        suggestions: action.payload,
      };

    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: [],
        conversationId: null,
      };

    default:
      return state;
  }
}

// Context type
interface ChatContextInterface {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  sendMessage: (content: string) => Promise<void>;
  clearConversation: () => void;
  setContext: (context: ChatContextType | null) => void;
  regenerateResponse: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  getSuggestions: () => Promise<void>;
  exportConversation: () => string;
  importConversation: (data: string) => void;
}

const ChatContext = createContext<ChatContextInterface | undefined>(undefined);

// Mock AI response function (replace with actual AI API)
const mockAIResponse = async (message: string, context?: ChatContextType): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  const responses = [
    "That's a great question! Let me explain this concept step by step.",
    "I understand you're working on this topic. Here's how I can help you understand it better.",
    "Based on your learning progress, I think you might benefit from focusing on these key points.",
    "Let me break this down into simpler terms that align with your learning style.",
    "I notice you're struggling with this concept. Let's try a different approach.",
    "Excellent! You're making great progress. Let's build on what you've learned.",
    "Here's a practical example that might help clarify this concept for you.",
    "I can see from your recent activities that you're ready for more advanced topics.",
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
};

const mockGetSuggestions = async (context?: ChatContextType): Promise<string[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const suggestions = [
    "Can you explain this concept in simpler terms?",
    "What are some real-world examples?",
    "How does this relate to what I learned earlier?",
    "Can you give me a practice problem?",
    "What should I study next?",
    "I'm confused about this part, can you help?",
    "Can you summarize the key points?",
    "How can I apply this knowledge?",
  ];
  
  return suggestions.slice(0, 4);
};

// Provider component
export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const [persistedChat, setPersistedChat] = useLocalStorage('chat', {
    messages: [],
    conversationId: null,
  });

  // Initialize chat state from localStorage
  useEffect(() => {
    if (persistedChat.messages && persistedChat.messages.length > 0) {
      persistedChat.messages.forEach((message: ChatMessage) => {
        dispatch({ type: 'ADD_MESSAGE', payload: message });
      });
    }
    if (persistedChat.conversationId) {
      dispatch({ type: 'SET_CONVERSATION_ID', payload: persistedChat.conversationId });
    }
  }, [persistedChat]);

  // Define functions first to avoid initialization issues
  const getSuggestions = useCallback(async () => {
    try {
      const suggestions = await mockGetSuggestions(state.context || undefined);
      dispatch({ type: 'SET_SUGGESTIONS', payload: suggestions });
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    }
  }, [state.context]);

  // Persist chat state changes
  useEffect(() => {
    setPersistedChat({
      messages: state.messages,
      conversationId: state.conversationId,
    });
  }, [state.messages, state.conversationId, setPersistedChat]);

  // Generate suggestions when context changes
  useEffect(() => {
    if (state.context) {
      getSuggestions();
    }
  }, [state.context, getSuggestions]);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content,
      role: 'user',
      timestamp: new Date(),
      context: state.context || undefined,
    };

    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const aiResponse = await mockAIResponse(content, state.context || undefined);
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        content: aiResponse,
        role: 'assistant',
        timestamp: new Date(),
        context: state.context || undefined,
      };

      dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage });
      
      // Generate conversation ID if it doesn't exist
      if (!state.conversationId) {
        dispatch({ type: 'SET_CONVERSATION_ID', payload: `conv-${Date.now()}` });
      }
      
      // Clear error if message was successful
      if (state.error) {
        dispatch({ type: 'SET_ERROR', payload: null });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to send message' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.context, state.conversationId, state.error]);

  const clearConversation = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
    setPersistedChat({ messages: [], conversationId: null });
  }, [setPersistedChat]);

  const setContext = useCallback((context: ChatContextType | null) => {
    dispatch({ type: 'SET_CONTEXT', payload: context });
  }, []);

  const regenerateResponse = useCallback(async () => {
    if (state.messages.length < 2) return;

    // Get the last user message
    const lastUserMessage = [...state.messages].reverse().find(msg => msg.role === 'user');
    if (!lastUserMessage) return;

    // Remove the last assistant message
    const messagesWithoutLastAssistant = state.messages.slice(0, -1);
    dispatch({ type: 'CLEAR_MESSAGES' });
    messagesWithoutLastAssistant.forEach(msg => {
      dispatch({ type: 'ADD_MESSAGE', payload: msg });
    });

    // Generate new response
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const aiResponse = await mockAIResponse(lastUserMessage.content, state.context || undefined);
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        content: aiResponse,
        role: 'assistant',
        timestamp: new Date(),
        context: state.context || undefined,
      };

      dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to regenerate response' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.messages, state.context]);

  const loadConversation = useCallback(async (conversationId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // Mock loading conversation from API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // In a real implementation, you would fetch messages from the backend
      const mockMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          content: 'Hello! How can I help you with your learning today?',
          role: 'assistant',
          timestamp: new Date(Date.now() - 60000),
        },
      ];

      dispatch({ type: 'CLEAR_MESSAGES' });
      mockMessages.forEach(msg => {
        dispatch({ type: 'ADD_MESSAGE', payload: msg });
      });
      dispatch({ type: 'SET_CONVERSATION_ID', payload: conversationId });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load conversation' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const exportConversation = useCallback(() => {
    const exportData = {
      conversationId: state.conversationId,
      messages: state.messages,
      context: state.context,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(exportData, null, 2);
  }, [state.conversationId, state.messages, state.context]);

  const importConversation = useCallback((data: string) => {
    try {
      const importData = JSON.parse(data);
      
      dispatch({ type: 'CLEAR_MESSAGES' });
      
      if (importData.conversationId) {
        dispatch({ type: 'SET_CONVERSATION_ID', payload: importData.conversationId });
      }
      
      if (importData.messages && Array.isArray(importData.messages)) {
        importData.messages.forEach((msg: ChatMessage) => {
          dispatch({ type: 'ADD_MESSAGE', payload: msg });
        });
      }
      
      if (importData.context) {
        dispatch({ type: 'SET_CONTEXT', payload: importData.context });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to import conversation data' });
    }
  }, []);

  const value: ChatContextInterface = {
    state,
    dispatch,
    sendMessage,
    clearConversation,
    setContext,
    regenerateResponse,
    loadConversation,
    getSuggestions,
    exportConversation,
    importConversation,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// Hook to use the chat context
export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}