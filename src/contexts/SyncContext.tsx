'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode, useRef } from 'react';
import { SyncState, SyncAction, PendingChange, SyncConflict } from '@/types';
import { useLocalStorage } from '@/hooks/useStorage';

// Initial state
const initialState: SyncState = {
  isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  lastSync: null,
  pendingChanges: [],
  syncError: null,
  conflicts: [],
};

// Reducer function
function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case 'SET_ONLINE':
      return {
        ...state,
        isOnline: action.payload,
      };

    case 'SET_SYNCING':
      return {
        ...state,
        isSyncing: action.payload,
      };

    case 'SET_LAST_SYNC':
      return {
        ...state,
        lastSync: action.payload,
      };

    case 'ADD_PENDING_CHANGE':
      return {
        ...state,
        pendingChanges: [...state.pendingChanges, action.payload],
      };

    case 'REMOVE_PENDING_CHANGE':
      return {
        ...state,
        pendingChanges: state.pendingChanges.filter(change => change.id !== action.payload),
      };

    case 'SET_SYNC_ERROR':
      return {
        ...state,
        syncError: action.payload,
      };

    case 'ADD_CONFLICT':
      return {
        ...state,
        conflicts: [...state.conflicts, action.payload],
      };

    case 'RESOLVE_CONFLICT':
      return {
        ...state,
        conflicts: state.conflicts.map(conflict =>
          conflict.id === action.payload
            ? { ...conflict, resolved: true }
            : conflict
        ),
      };

    default:
      return state;
  }
}

// Context type
interface SyncContextType {
  state: SyncState;
  dispatch: React.Dispatch<SyncAction>;
  addPendingChange: (change: Omit<PendingChange, 'id' | 'timestamp' | 'attempts'>) => void;
  sync: () => Promise<void>;
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote') => Promise<void>;
  forcePush: () => Promise<void>;
  forcePull: () => Promise<void>;
  clearPendingChanges: () => void;
  retryFailedSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

// Mock sync API functions (replace with actual API calls)
const mockSyncToServer = async (changes: PendingChange[]): Promise<{
  successful: string[];
  failed: { id: string; error: string }[];
  conflicts: SyncConflict[];
}> => {
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  // Simulate some failures and conflicts
  const successful = changes.slice(0, Math.floor(changes.length * 0.8)).map(c => c.id);
  const failed = changes.slice(Math.floor(changes.length * 0.8)).map(c => ({
    id: c.id,
    error: 'Network error or server unavailable',
  }));
  
  const conflicts: SyncConflict[] = Math.random() > 0.7 ? [
    {
      id: `conflict-${Date.now()}`,
      entity: 'progress',
      local: { score: 85, timestamp: new Date(Date.now() - 5000) },
      remote: { score: 90, timestamp: new Date() },
      timestamp: new Date(),
      resolved: false,
    },
  ] : [];
  
  return { successful, failed, conflicts };
};

const mockPullFromServer = async (): Promise<{
  data: any[];
  lastSync: Date;
}> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return {
    data: [], // Mock server data
    lastSync: new Date(),
  };
};

// Provider component
export function SyncProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(syncReducer, initialState);
  const [persistedSync, setPersistedSync] = useLocalStorage('sync', {
    lastSync: null,
    pendingChanges: [],
  });
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize sync state from localStorage
  useEffect(() => {
    if (persistedSync.lastSync) {
      dispatch({ type: 'SET_LAST_SYNC', payload: new Date(persistedSync.lastSync) });
    }
    if (persistedSync.pendingChanges) {
      persistedSync.pendingChanges.forEach((change: PendingChange) => {
        dispatch({ type: 'ADD_PENDING_CHANGE', payload: change });
      });
    }
  }, [persistedSync]);

  // Persist sync state changes
  useEffect(() => {
    setPersistedSync({
      lastSync: state.lastSync,
      pendingChanges: state.pendingChanges,
    });
  }, [state.lastSync, state.pendingChanges, setPersistedSync]);

  // Online/offline detection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      dispatch({ type: 'SET_ONLINE', payload: true });
      // Automatically sync when coming back online
      if (state.pendingChanges.length > 0) {
        setTimeout(() => sync(), 1000);
      }
    };

    const handleOffline = () => {
      dispatch({ type: 'SET_ONLINE', payload: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state.pendingChanges.length]);

  // Periodic sync
  useEffect(() => {
    if (state.isOnline && !state.isSyncing) {
      syncIntervalRef.current = setInterval(() => {
        if (state.pendingChanges.length > 0) {
          sync();
        }
      }, 30000); // Sync every 30 seconds

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [state.isOnline, state.isSyncing, state.pendingChanges.length]);

  // Retry failed syncs with exponential backoff
  useEffect(() => {
    if (state.syncError && state.pendingChanges.length > 0) {
      const retryDelay = Math.min(30000, 1000 * Math.pow(2, state.pendingChanges[0]?.attempts || 0));
      
      retryTimeoutRef.current = setTimeout(() => {
        retryFailedSync();
      }, retryDelay);

      return () => {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
      };
    }
  }, [state.syncError, state.pendingChanges]);

  const addPendingChange = useCallback((changeData: Omit<PendingChange, 'id' | 'timestamp' | 'attempts'>) => {
    const change: PendingChange = {
      ...changeData,
      id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      attempts: 0,
    };

    dispatch({ type: 'ADD_PENDING_CHANGE', payload: change });

    // Trigger sync if online
    if (state.isOnline && !state.isSyncing) {
      setTimeout(() => sync(), 100);
    }
  }, [state.isOnline, state.isSyncing]);

  const sync = useCallback(async () => {
    if (!state.isOnline || state.isSyncing || state.pendingChanges.length === 0) {
      return;
    }

    dispatch({ type: 'SET_SYNCING', payload: true });
    dispatch({ type: 'SET_SYNC_ERROR', payload: null });

    try {
      const result = await mockSyncToServer(state.pendingChanges);

      // Remove successful changes
      result.successful.forEach(id => {
        dispatch({ type: 'REMOVE_PENDING_CHANGE', payload: id });
      });

      // Update attempts for failed changes
      result.failed.forEach(({ id, error }) => {
        const failedChange = state.pendingChanges.find(c => c.id === id);
        if (failedChange) {
          const updatedChange = {
            ...failedChange,
            attempts: failedChange.attempts + 1,
          };
          dispatch({ type: 'REMOVE_PENDING_CHANGE', payload: id });
          dispatch({ type: 'ADD_PENDING_CHANGE', payload: updatedChange });
        }
      });

      // Add conflicts
      result.conflicts.forEach(conflict => {
        dispatch({ type: 'ADD_CONFLICT', payload: conflict });
      });

      // Update last sync time
      dispatch({ type: 'SET_LAST_SYNC', payload: new Date() });

      // Set error if there were failures
      if (result.failed.length > 0) {
        dispatch({ type: 'SET_SYNC_ERROR', payload: `Failed to sync ${result.failed.length} changes` });
      }
    } catch (error) {
      dispatch({ type: 'SET_SYNC_ERROR', payload: error instanceof Error ? error.message : 'Sync failed' });
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: false });
    }
  }, [state.isOnline, state.isSyncing, state.pendingChanges]);

  const resolveConflict = useCallback(async (conflictId: string, resolution: 'local' | 'remote') => {
    const conflict = state.conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    try {
      // Apply resolution based on choice
      const resolvedData = resolution === 'local' ? conflict.local : conflict.remote;
      
      // Here you would typically apply the resolved data to your state
      // For now, we'll just mark the conflict as resolved
      dispatch({ type: 'RESOLVE_CONFLICT', payload: conflictId });
      
      // If resolving with local data, add it as a pending change
      if (resolution === 'local') {
        addPendingChange({
          type: 'update',
          entity: conflict.entity,
          data: conflict.local,
        });
      }
    } catch (error) {
      dispatch({ type: 'SET_SYNC_ERROR', payload: error instanceof Error ? error.message : 'Failed to resolve conflict' });
    }
  }, [state.conflicts, addPendingChange]);

  const forcePush = useCallback(async () => {
    if (!state.isOnline) return;

    dispatch({ type: 'SET_SYNCING', payload: true });
    try {
      // Force push all pending changes, ignoring conflicts
      const result = await mockSyncToServer(state.pendingChanges);
      
      // Remove all changes regardless of success/failure
      state.pendingChanges.forEach(change => {
        dispatch({ type: 'REMOVE_PENDING_CHANGE', payload: change.id });
      });
      
      dispatch({ type: 'SET_LAST_SYNC', payload: new Date() });
      dispatch({ type: 'SET_SYNC_ERROR', payload: null });
    } catch (error) {
      dispatch({ type: 'SET_SYNC_ERROR', payload: error instanceof Error ? error.message : 'Force push failed' });
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: false });
    }
  }, [state.isOnline, state.pendingChanges]);

  const forcePull = useCallback(async () => {
    if (!state.isOnline) return;

    dispatch({ type: 'SET_SYNCING', payload: true });
    try {
      const result = await mockPullFromServer();
      
      // Clear all pending changes and conflicts
      state.pendingChanges.forEach(change => {
        dispatch({ type: 'REMOVE_PENDING_CHANGE', payload: change.id });
      });
      
      // Clear conflicts
      state.conflicts.forEach(conflict => {
        dispatch({ type: 'RESOLVE_CONFLICT', payload: conflict.id });
      });
      
      dispatch({ type: 'SET_LAST_SYNC', payload: result.lastSync });
      dispatch({ type: 'SET_SYNC_ERROR', payload: null });
      
      // Here you would typically update your app state with the pulled data
    } catch (error) {
      dispatch({ type: 'SET_SYNC_ERROR', payload: error instanceof Error ? error.message : 'Force pull failed' });
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: false });
    }
  }, [state.isOnline, state.pendingChanges, state.conflicts]);

  const clearPendingChanges = useCallback(() => {
    state.pendingChanges.forEach(change => {
      dispatch({ type: 'REMOVE_PENDING_CHANGE', payload: change.id });
    });
    dispatch({ type: 'SET_SYNC_ERROR', payload: null });
  }, [state.pendingChanges]);

  const retryFailedSync = useCallback(async () => {
    if (state.pendingChanges.length === 0) return;
    
    // Only retry changes that haven't exceeded max attempts
    const retryableChanges = state.pendingChanges.filter(change => change.attempts < 3);
    
    if (retryableChanges.length === 0) {
      dispatch({ type: 'SET_SYNC_ERROR', payload: 'Max retry attempts reached for all changes' });
      return;
    }

    await sync();
  }, [state.pendingChanges, sync]);

  const value: SyncContextType = {
    state,
    dispatch,
    addPendingChange,
    sync,
    resolveConflict,
    forcePush,
    forcePull,
    clearPendingChanges,
    retryFailedSync,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

// Hook to use the sync context
export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

// Higher-order component for automatic sync integration
export function withSync<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function SyncWrappedComponent(props: P) {
    const sync = useSync();
    
    return <Component {...props} sync={sync} />;
  };
}