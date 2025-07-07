import { supabase } from './supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { 
  LearningSession, 
  Recommendation, 
  UserPreferences,
  LearningProfile 
} from '@/types/supabase';

// ==========================================
// REAL-TIME EVENT TYPES
// ==========================================

export interface RealtimeEvent<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: T | null;
  table: string;
  schema: string;
  commit_timestamp: string;
}

export interface LearningSessionEvent extends RealtimeEvent<LearningSession> {}
export interface RecommendationEvent extends RealtimeEvent<Recommendation> {}
export interface UserPreferencesEvent extends RealtimeEvent<UserPreferences> {}
export interface LearningProfileEvent extends RealtimeEvent<LearningProfile> {}

// ==========================================
// REAL-TIME SUBSCRIPTION MANAGER
// ==========================================

export class RealtimeSubscriptionManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  /**
   * Subscribe to learning session updates
   */
  subscribeLearningSession(
    sessionId: string,
    callbacks: {
      onUpdate?: (session: LearningSession) => void;
      onInsert?: (session: LearningSession) => void;
      onDelete?: (session: LearningSession) => void;
      onError?: (error: any) => void;
    }
  ): RealtimeChannel {
    const channelId = `learning_session_${sessionId}`;
    
    // Unsubscribe existing channel if it exists
    this.unsubscribe(channelId);

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'learning_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload: RealtimePostgresChangesPayload<LearningSession>) => {
          try {
            switch (payload.eventType) {
              case 'UPDATE':
                if (payload.new && callbacks.onUpdate) {
                  callbacks.onUpdate(payload.new);
                }
                break;
              case 'INSERT':
                if (payload.new && callbacks.onInsert) {
                  callbacks.onInsert(payload.new);
                }
                break;
              case 'DELETE':
                if (payload.old && callbacks.onDelete) {
                  callbacks.onDelete(payload.old);
                }
                break;
            }
          } catch (error) {
            console.error('Error handling learning session update:', error);
            if (callbacks.onError) {
              callbacks.onError(error);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to learning session ${sessionId}`);
          this.reconnectAttempts.delete(channelId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Error subscribing to learning session ${sessionId}`);
          this.handleReconnection(channelId, () => 
            this.subscribeLearningSession(sessionId, callbacks)
          );
        }
      });

    this.channels.set(channelId, channel);
    return channel;
  }

  /**
   * Subscribe to user's learning sessions
   */
  subscribeUserLearningSessions(
    userId: string,
    callbacks: {
      onUpdate?: (session: LearningSession) => void;
      onInsert?: (session: LearningSession) => void;
      onDelete?: (session: LearningSession) => void;
      onError?: (error: any) => void;
    }
  ): RealtimeChannel {
    const channelId = `user_sessions_${userId}`;
    
    this.unsubscribe(channelId);

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'learning_sessions',
          filter: `user_id=eq.${userId}`
        },
        (payload: RealtimePostgresChangesPayload<LearningSession>) => {
          try {
            switch (payload.eventType) {
              case 'UPDATE':
                if (payload.new && callbacks.onUpdate) {
                  callbacks.onUpdate(payload.new);
                }
                break;
              case 'INSERT':
                if (payload.new && callbacks.onInsert) {
                  callbacks.onInsert(payload.new);
                }
                break;
              case 'DELETE':
                if (payload.old && callbacks.onDelete) {
                  callbacks.onDelete(payload.old);
                }
                break;
            }
          } catch (error) {
            console.error('Error handling user session update:', error);
            if (callbacks.onError) {
              callbacks.onError(error);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to user sessions for ${userId}`);
          this.reconnectAttempts.delete(channelId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Error subscribing to user sessions for ${userId}`);
          this.handleReconnection(channelId, () => 
            this.subscribeUserLearningSessions(userId, callbacks)
          );
        }
      });

    this.channels.set(channelId, channel);
    return channel;
  }

  /**
   * Subscribe to user recommendations
   */
  subscribeUserRecommendations(
    userId: string,
    callbacks: {
      onUpdate?: (recommendation: Recommendation) => void;
      onInsert?: (recommendation: Recommendation) => void;
      onDelete?: (recommendation: Recommendation) => void;
      onError?: (error: any) => void;
    }
  ): RealtimeChannel {
    const channelId = `user_recommendations_${userId}`;
    
    this.unsubscribe(channelId);

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recommendations',
          filter: `user_id=eq.${userId}`
        },
        (payload: RealtimePostgresChangesPayload<Recommendation>) => {
          try {
            switch (payload.eventType) {
              case 'UPDATE':
                if (payload.new && callbacks.onUpdate) {
                  callbacks.onUpdate(payload.new);
                }
                break;
              case 'INSERT':
                if (payload.new && callbacks.onInsert) {
                  callbacks.onInsert(payload.new);
                }
                break;
              case 'DELETE':
                if (payload.old && callbacks.onDelete) {
                  callbacks.onDelete(payload.old);
                }
                break;
            }
          } catch (error) {
            console.error('Error handling recommendation update:', error);
            if (callbacks.onError) {
              callbacks.onError(error);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to recommendations for ${userId}`);
          this.reconnectAttempts.delete(channelId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Error subscribing to recommendations for ${userId}`);
          this.handleReconnection(channelId, () => 
            this.subscribeUserRecommendations(userId, callbacks)
          );
        }
      });

    this.channels.set(channelId, channel);
    return channel;
  }

  /**
   * Subscribe to user preferences changes
   */
  subscribeUserPreferences(
    userId: string,
    callbacks: {
      onUpdate?: (preferences: UserPreferences) => void;
      onInsert?: (preferences: UserPreferences) => void;
      onError?: (error: any) => void;
    }
  ): RealtimeChannel {
    const channelId = `user_preferences_${userId}`;
    
    this.unsubscribe(channelId);

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_preferences',
          filter: `user_id=eq.${userId}`
        },
        (payload: RealtimePostgresChangesPayload<UserPreferences>) => {
          try {
            switch (payload.eventType) {
              case 'UPDATE':
                if (payload.new && callbacks.onUpdate) {
                  callbacks.onUpdate(payload.new);
                }
                break;
              case 'INSERT':
                if (payload.new && callbacks.onInsert) {
                  callbacks.onInsert(payload.new);
                }
                break;
            }
          } catch (error) {
            console.error('Error handling preferences update:', error);
            if (callbacks.onError) {
              callbacks.onError(error);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to preferences for ${userId}`);
          this.reconnectAttempts.delete(channelId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Error subscribing to preferences for ${userId}`);
          this.handleReconnection(channelId, () => 
            this.subscribeUserPreferences(userId, callbacks)
          );
        }
      });

    this.channels.set(channelId, channel);
    return channel;
  }

  /**
   * Subscribe to learning profile changes
   */
  subscribeLearningProfile(
    userId: string,
    callbacks: {
      onUpdate?: (profile: LearningProfile) => void;
      onInsert?: (profile: LearningProfile) => void;
      onError?: (error: any) => void;
    }
  ): RealtimeChannel {
    const channelId = `learning_profile_${userId}`;
    
    this.unsubscribe(channelId);

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'learning_profiles',
          filter: `user_id=eq.${userId}`
        },
        (payload: RealtimePostgresChangesPayload<LearningProfile>) => {
          try {
            switch (payload.eventType) {
              case 'UPDATE':
                if (payload.new && callbacks.onUpdate) {
                  callbacks.onUpdate(payload.new);
                }
                break;
              case 'INSERT':
                if (payload.new && callbacks.onInsert) {
                  callbacks.onInsert(payload.new);
                }
                break;
            }
          } catch (error) {
            console.error('Error handling learning profile update:', error);
            if (callbacks.onError) {
              callbacks.onError(error);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to learning profile for ${userId}`);
          this.reconnectAttempts.delete(channelId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Error subscribing to learning profile for ${userId}`);
          this.handleReconnection(channelId, () => 
            this.subscribeLearningProfile(userId, callbacks)
          );
        }
      });

    this.channels.set(channelId, channel);
    return channel;
  }

  /**
   * Create a custom broadcast channel for real-time communication
   */
  createBroadcastChannel(
    channelName: string,
    onMessage?: (message: any) => void,
    onError?: (error: any) => void
  ): RealtimeChannel {
    const channelId = `broadcast_${channelName}`;
    
    this.unsubscribe(channelId);

    const channel = supabase
      .channel(channelId)
      .on('broadcast', { event: 'message' }, (payload) => {
        try {
          if (onMessage) {
            onMessage(payload);
          }
        } catch (error) {
          console.error('Error handling broadcast message:', error);
          if (onError) {
            onError(error);
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to broadcast channel ${channelName}`);
          this.reconnectAttempts.delete(channelId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Error subscribing to broadcast channel ${channelName}`);
          this.handleReconnection(channelId, () => 
            this.createBroadcastChannel(channelName, onMessage, onError)
          );
        }
      });

    this.channels.set(channelId, channel);
    return channel;
  }

  /**
   * Send a broadcast message
   */
  async sendBroadcast(channelName: string, message: any): Promise<void> {
    const channelId = `broadcast_${channelName}`;
    const channel = this.channels.get(channelId);
    
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'message',
        payload: message
      });
    } else {
      console.warn(`Channel ${channelName} not found for broadcast`);
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnection(channelId: string, reconnectFn: () => void): void {
    const attempts = this.reconnectAttempts.get(channelId) || 0;
    
    if (attempts < this.maxReconnectAttempts) {
      this.reconnectAttempts.set(channelId, attempts + 1);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect ${channelId} (attempt ${attempts + 1})`);
        reconnectFn();
      }, this.reconnectDelay * Math.pow(2, attempts)); // Exponential backoff
    } else {
      console.error(`Max reconnection attempts reached for ${channelId}`);
      this.reconnectAttempts.delete(channelId);
    }
  }

  /**
   * Unsubscribe from a specific channel
   */
  unsubscribe(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelId);
      this.reconnectAttempts.delete(channelId);
      console.log(`Unsubscribed from ${channelId}`);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    for (const [channelId, channel] of this.channels) {
      supabase.removeChannel(channel);
      console.log(`Unsubscribed from ${channelId}`);
    }
    this.channels.clear();
    this.reconnectAttempts.clear();
  }

  /**
   * Get the status of all active channels
   */
  getChannelStatuses(): Record<string, string> {
    const statuses: Record<string, string> = {};
    
    for (const [channelId, channel] of this.channels) {
      statuses[channelId] = channel.state;
    }
    
    return statuses;
  }

  /**
   * Check if a channel is active
   */
  isChannelActive(channelId: string): boolean {
    const channel = this.channels.get(channelId);
    return channel ? channel.state === 'joined' : false;
  }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

export const realtimeManager = new RealtimeSubscriptionManager();

// ==========================================
// CONVENIENCE HOOKS FOR REACT COMPONENTS
// ==========================================

/**
 * Hook for learning session subscriptions (to be used in React components)
 */
export function useLearningSessionSubscription(
  sessionId: string | null,
  callbacks: {
    onUpdate?: (session: LearningSession) => void;
    onInsert?: (session: LearningSession) => void;
    onDelete?: (session: LearningSession) => void;
    onError?: (error: any) => void;
  }
) {
  // This would be implemented as a React hook in a separate file
  // For now, it's just a placeholder to show the intended API
  console.log('Learning session subscription hook would be implemented here');
}

/**
 * Hook for user recommendations subscription
 */
export function useRecommendationsSubscription(
  userId: string | null,
  callbacks: {
    onUpdate?: (recommendation: Recommendation) => void;
    onInsert?: (recommendation: Recommendation) => void;
    onDelete?: (recommendation: Recommendation) => void;
    onError?: (error: any) => void;
  }
) {
  console.log('Recommendations subscription hook would be implemented here');
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Create a presence system for collaborative learning
 */
export function createPresenceChannel(
  channelName: string,
  userInfo: { id: string; name: string; avatar?: string }
) {
  const channel = supabase.channel(channelName, {
    config: {
      presence: {
        key: userInfo.id,
      },
    },
  });

  // Track presence
  channel
    .on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      console.log('Presence sync:', presenceState);
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('User joined:', key, newPresences);
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('User left:', key, leftPresences);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(userInfo);
      }
    });

  return channel;
}

export default realtimeManager;