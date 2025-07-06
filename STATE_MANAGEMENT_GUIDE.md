# State Management System Documentation

## Overview

This comprehensive state management system provides a robust, scalable, and performant solution for the Personal Learning Assistant. It includes multiple specialized contexts, advanced hooks, and optimization features.

## Architecture

### Core Contexts

1. **AuthContext** (`/src/contexts/AuthContext.tsx`)
   - User authentication and session management
   - Automatic token refresh
   - Persistent login state

2. **LearningContext** (`/src/contexts/LearningContext.tsx`)
   - Learning paths and progress tracking
   - Session management
   - Analytics and performance metrics

3. **QuizContext** (`/src/contexts/QuizContext.tsx`)
   - Quiz and assessment state
   - Adaptive questioning
   - Real-time scoring and feedback

4. **ChatContext** (`/src/contexts/ChatContext.tsx`)
   - AI chat interactions
   - Conversation history
   - Context-aware suggestions

5. **NotificationContext** (`/src/contexts/NotificationContext.tsx`)
   - In-app notifications and alerts
   - Browser push notifications
   - Notification preferences

6. **SyncContext** (`/src/contexts/SyncContext.tsx`)
   - Real-time synchronization
   - Offline support
   - Conflict resolution

7. **UIContext** (`/src/contexts/UIContext.tsx`)
   - Theme management
   - Modal and toast system
   - UI state persistence

## Usage

### Setup

```tsx
import { EnhancedRootProvider } from '@/contexts';

function App() {
  return (
    <EnhancedRootProvider>
      <YourAppComponents />
    </EnhancedRootProvider>
  );
}
```

### Using Individual Contexts

```tsx
import { useAuth, useLearning, useNotifications } from '@/contexts';

function MyComponent() {
  const { state: authState, login, logout } = useAuth();
  const { state: learningState, loadAllPaths } = useLearning();
  const { addNotification } = useNotifications();

  // Your component logic
}
```

### Using Combined State

```tsx
import { useAppState } from '@/contexts';

function MyComponent() {
  const { auth, learning, quiz, chat, notifications, sync, ui } = useAppState();
  
  // Access all contexts in one place
}
```

## Advanced Features

### Performance Hooks

```tsx
import { 
  useDebounce, 
  useThrottle, 
  useVirtualScroll,
  usePerformanceMonitor 
} from '@/hooks';

function OptimizedComponent() {
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { startMeasure, endMeasure } = usePerformanceMonitor();
  
  // Performance optimizations
}
```

### Storage Hooks

```tsx
import { 
  useLocalStorage, 
  useSessionStorage, 
  useIndexedDB,
  useCachedStorage 
} from '@/hooks';

function PersistentComponent() {
  const [data, setData] = useLocalStorage('key', defaultValue, {
    version: 1,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
  
  // Enhanced storage with versioning and expiration
}
```

### Sync Management

```tsx
import { useSync } from '@/contexts';

function SyncAwareComponent() {
  const { state, addPendingChange, resolveConflict } = useSync();
  
  const handleDataChange = (data) => {
    addPendingChange({
      type: 'update',
      entity: 'progress',
      data,
    });
  };
  
  // Automatic synchronization
}
```

## Key Features

### 1. Type Safety
- Full TypeScript integration
- Strongly typed actions and state
- IntelliSense support

### 2. Performance Optimization
- Memoized selectors
- Debounced updates
- Virtual scrolling support
- Lazy loading utilities

### 3. Persistence
- Local storage with versioning
- Session storage support
- IndexedDB for large data
- Automatic state hydration

### 4. Real-time Sync
- Offline support
- Conflict resolution
- Automatic retry with exponential backoff
- Online/offline detection

### 5. Developer Experience
- Development tools integration
- Error boundaries
- Performance monitoring
- State export/import

### 6. Notifications
- Toast messages
- Browser push notifications
- In-app alerts
- Notification preferences

## Error Handling

The system includes comprehensive error handling:

- **Error Boundaries**: Catch and recover from context errors
- **Graceful Degradation**: Continue functioning when services are unavailable
- **User Feedback**: Clear error messages and recovery options

## Testing

All contexts include mock implementations for testing:

```tsx
import { render } from '@testing-library/react';
import { AuthProvider } from '@/contexts';

function TestWrapper({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}

// Use in tests
```

## Best Practices

1. **Context Composition**: Use specific contexts instead of global state when possible
2. **Performance**: Implement proper memoization and avoid unnecessary re-renders
3. **Error Handling**: Always handle loading and error states
4. **Type Safety**: Use TypeScript interfaces consistently
5. **Testing**: Write tests for all context logic

## Migration from Legacy State

If migrating from the existing AppContext:

```tsx
// Old way
import { useApp } from '@/contexts/AppContext';

// New way
import { useAuth, useLearning } from '@/contexts';

function MyComponent() {
  // Replace useApp with specific contexts
  const { state: authState } = useAuth();
  const { state: learningState } = useLearning();
}
```

## Performance Monitoring

Enable development tools in development mode:

```tsx
// Available in browser console
__LEARNING_ASSISTANT_DEV__.getState() // Get current state
__LEARNING_ASSISTANT_DEV__.clearStorage() // Clear all storage
__LEARNING_ASSISTANT_DEV__.exportState() // Export state to JSON
```

## API Integration

All contexts include mock implementations that can be easily replaced with real API calls:

```tsx
// In AuthContext.tsx
const mockLogin = async (email: string, password: string) => {
  // Replace with actual API call
  return await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};
```

## Troubleshooting

### Common Issues

1. **Context not found error**: Ensure components are wrapped in appropriate providers
2. **State not persisting**: Check localStorage permissions and quotas
3. **Sync conflicts**: Use the conflict resolution UI to handle data conflicts
4. **Performance issues**: Enable performance monitoring to identify bottlenecks

### Debug Tools

- Use React DevTools for component inspection
- Enable console logging in development mode
- Use the built-in state export feature for debugging
- Monitor network requests in browser DevTools

## Contributing

When adding new state management features:

1. Follow the existing patterns and naming conventions
2. Add TypeScript types to `/src/types/index.ts`
3. Include error handling and loading states
4. Write comprehensive tests
5. Update this documentation

## File Structure

```
src/
├── contexts/
│   ├── AuthContext.tsx
│   ├── LearningContext.tsx
│   ├── QuizContext.tsx
│   ├── ChatContext.tsx
│   ├── NotificationContext.tsx
│   ├── SyncContext.tsx
│   ├── UIContext.tsx
│   ├── RootProvider.tsx
│   └── index.ts
├── hooks/
│   ├── useLocalStorage.ts
│   ├── useStorage.ts
│   ├── usePerformance.ts
│   ├── useDebounce.ts
│   └── index.ts
└── types/
    └── index.ts (state management types)
```

This state management system provides a solid foundation for building scalable, performant React applications with comprehensive state management needs.