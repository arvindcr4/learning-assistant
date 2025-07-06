import { 
  ChatSession, 
  ChatMessage, 
  TutoringSession, 
  ChatAnalytics,
  LearningContext 
} from '../types';

export interface ChatStorageOptions {
  persistenceType: 'localStorage' | 'indexedDB' | 'memory';
  encryptData?: boolean;
  compressionEnabled?: boolean;
  maxStorageSize?: number; // in MB
  autoCleanup?: boolean;
  retentionDays?: number;
}

export class ChatStorageService {
  private options: ChatStorageOptions;
  private dbName = 'learning-assistant-chat';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  constructor(options: Partial<ChatStorageOptions> = {}) {
    this.options = {
      persistenceType: 'localStorage',
      encryptData: false,
      compressionEnabled: false,
      maxStorageSize: 50, // 50MB default
      autoCleanup: true,
      retentionDays: 90,
      ...options
    };

    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    if (this.options.persistenceType === 'indexedDB') {
      await this.initializeIndexedDB();
    }
    
    if (this.options.autoCleanup) {
      this.scheduleCleanup();
    }
  }

  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('userId', 'userId', { unique: false });
          sessionStore.createIndex('createdAt', 'createdAt', { unique: false });
          sessionStore.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('sessionId', 'sessionId', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
          messageStore.createIndex('role', 'role', { unique: false });
        }

        if (!db.objectStoreNames.contains('tutoringSessions')) {
          const tutoringStore = db.createObjectStore('tutoringSessions', { keyPath: 'id' });
          tutoringStore.createIndex('userId', 'userId', { unique: false });
          tutoringStore.createIndex('startTime', 'startTime', { unique: false });
        }

        if (!db.objectStoreNames.contains('analytics')) {
          const analyticsStore = db.createObjectStore('analytics', { keyPath: 'sessionId' });
          analyticsStore.createIndex('userId', 'userId', { unique: false });
          analyticsStore.createIndex('generatedAt', 'generatedAt', { unique: false });
        }
      };
    });
  }

  // Session Storage
  async saveSession(session: ChatSession): Promise<void> {
    const serializedSession = this.serializeSession(session);
    
    switch (this.options.persistenceType) {
      case 'localStorage':
        this.saveToLocalStorage(`session_${session.id}`, serializedSession);
        break;
      case 'indexedDB':
        await this.saveToIndexedDB('sessions', serializedSession);
        break;
      case 'memory':
        // Already handled by ConversationService
        break;
    }

    // Save messages separately for better performance
    if (session.messages && session.messages.length > 0) {
      await this.saveMessages(session.id, session.messages);
    }
  }

  async loadSession(sessionId: string): Promise<ChatSession | null> {
    let sessionData: any = null;

    switch (this.options.persistenceType) {
      case 'localStorage':
        sessionData = this.loadFromLocalStorage(`session_${sessionId}`);
        break;
      case 'indexedDB':
        sessionData = await this.loadFromIndexedDB('sessions', sessionId);
        break;
      case 'memory':
        return null; // Handled by ConversationService
    }

    if (!sessionData) return null;

    // Load messages separately
    const messages = await this.loadMessages(sessionId);
    sessionData.messages = messages || [];

    return this.deserializeSession(sessionData);
  }

  async loadUserSessions(userId: string): Promise<ChatSession[]> {
    switch (this.options.persistenceType) {
      case 'localStorage':
        return this.loadUserSessionsFromLocalStorage(userId);
      case 'indexedDB':
        return this.loadUserSessionsFromIndexedDB(userId);
      case 'memory':
        return []; // Handled by ConversationService
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    switch (this.options.persistenceType) {
      case 'localStorage':
        localStorage.removeItem(`session_${sessionId}`);
        this.deleteMessagesFromLocalStorage(sessionId);
        break;
      case 'indexedDB':
        await this.deleteFromIndexedDB('sessions', sessionId);
        await this.deleteMessagesFromIndexedDB(sessionId);
        break;
      case 'memory':
        // Handled by ConversationService
        break;
    }
  }

  // Message Storage
  async saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const serializedMessages = messages.map(msg => ({
      ...this.serializeMessage(msg),
      sessionId
    }));

    switch (this.options.persistenceType) {
      case 'localStorage':
        this.saveToLocalStorage(`messages_${sessionId}`, serializedMessages);
        break;
      case 'indexedDB':
        await this.saveMessagesToIndexedDB(serializedMessages);
        break;
      case 'memory':
        // Handled by ConversationService
        break;
    }
  }

  async loadMessages(sessionId: string): Promise<ChatMessage[]> {
    let messagesData: any[] = [];

    switch (this.options.persistenceType) {
      case 'localStorage':
        messagesData = this.loadFromLocalStorage(`messages_${sessionId}`) || [];
        break;
      case 'indexedDB':
        messagesData = await this.loadMessagesFromIndexedDB(sessionId);
        break;
      case 'memory':
        return []; // Handled by ConversationService
    }

    return messagesData.map(msg => this.deserializeMessage(msg));
  }

  async saveMessage(sessionId: string, message: ChatMessage): Promise<void> {
    // Load existing messages, add new one, and save
    const existingMessages = await this.loadMessages(sessionId);
    existingMessages.push(message);
    await this.saveMessages(sessionId, existingMessages);
  }

  // Tutoring Session Storage
  async saveTutoringSession(session: TutoringSession): Promise<void> {
    const serializedSession = this.serializeTutoringSession(session);

    switch (this.options.persistenceType) {
      case 'localStorage':
        this.saveToLocalStorage(`tutoring_${session.id}`, serializedSession);
        break;
      case 'indexedDB':
        await this.saveToIndexedDB('tutoringSessions', serializedSession);
        break;
      case 'memory':
        // Handled by TutoringService
        break;
    }
  }

  async loadTutoringSession(sessionId: string): Promise<TutoringSession | null> {
    let sessionData: any = null;

    switch (this.options.persistenceType) {
      case 'localStorage':
        sessionData = this.loadFromLocalStorage(`tutoring_${sessionId}`);
        break;
      case 'indexedDB':
        sessionData = await this.loadFromIndexedDB('tutoringSessions', sessionId);
        break;
      case 'memory':
        return null;
    }

    return sessionData ? this.deserializeTutoringSession(sessionData) : null;
  }

  async loadUserTutoringSessions(userId: string): Promise<TutoringSession[]> {
    switch (this.options.persistenceType) {
      case 'localStorage':
        return this.loadUserTutoringSessionsFromLocalStorage(userId);
      case 'indexedDB':
        return this.loadUserTutoringSessionsFromIndexedDB(userId);
      case 'memory':
        return [];
    }
  }

  // Analytics Storage
  async saveAnalytics(analytics: ChatAnalytics): Promise<void> {
    const serializedAnalytics = this.serializeAnalytics(analytics);

    switch (this.options.persistenceType) {
      case 'localStorage':
        this.saveToLocalStorage(`analytics_${analytics.sessionId}`, serializedAnalytics);
        break;
      case 'indexedDB':
        await this.saveToIndexedDB('analytics', serializedAnalytics);
        break;
      case 'memory':
        // Could be handled by a separate analytics service
        break;
    }
  }

  async loadAnalytics(sessionId: string): Promise<ChatAnalytics | null> {
    let analyticsData: any = null;

    switch (this.options.persistenceType) {
      case 'localStorage':
        analyticsData = this.loadFromLocalStorage(`analytics_${sessionId}`);
        break;
      case 'indexedDB':
        analyticsData = await this.loadFromIndexedDB('analytics', sessionId);
        break;
      case 'memory':
        return null;
    }

    return analyticsData ? this.deserializeAnalytics(analyticsData) : null;
  }

  // Utility Methods
  async getStorageStats(): Promise<{
    totalSessions: number;
    totalMessages: number;
    totalSize: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  }> {
    // Implementation depends on storage type
    switch (this.options.persistenceType) {
      case 'localStorage':
        return this.getLocalStorageStats();
      case 'indexedDB':
        return this.getIndexedDBStats();
      case 'memory':
        return {
          totalSessions: 0,
          totalMessages: 0,
          totalSize: 0,
          oldestSession: null,
          newestSession: null
        };
    }
  }

  async cleanup(): Promise<void> {
    if (!this.options.autoCleanup || !this.options.retentionDays) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.options.retentionDays);

    switch (this.options.persistenceType) {
      case 'localStorage':
        await this.cleanupLocalStorage(cutoffDate);
        break;
      case 'indexedDB':
        await this.cleanupIndexedDB(cutoffDate);
        break;
    }
  }

  async exportData(userId: string): Promise<{
    sessions: ChatSession[];
    tutoringSessions: TutoringSession[];
    analytics: ChatAnalytics[];
    exportDate: string;
  }> {
    const sessions = await this.loadUserSessions(userId);
    const tutoringSessions = await this.loadUserTutoringSessions(userId);
    const analytics = await Promise.all(
      sessions.map(session => this.loadAnalytics(session.id))
    );

    return {
      sessions,
      tutoringSessions,
      analytics: analytics.filter(a => a !== null) as ChatAnalytics[],
      exportDate: new Date().toISOString()
    };
  }

  async importData(data: any): Promise<void> {
    // Import sessions
    for (const session of data.sessions || []) {
      await this.saveSession(session);
    }

    // Import tutoring sessions
    for (const session of data.tutoringSessions || []) {
      await this.saveTutoringSession(session);
    }

    // Import analytics
    for (const analytics of data.analytics || []) {
      await this.saveAnalytics(analytics);
    }
  }

  // Private Implementation Methods
  private serializeSession(session: ChatSession): any {
    return {
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      lastMessageAt: session.lastMessageAt.toISOString(),
      messages: [] // Stored separately
    };
  }

  private deserializeSession(data: any): ChatSession {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      lastMessageAt: new Date(data.lastMessageAt),
      messages: [] // Loaded separately
    };
  }

  private serializeMessage(message: ChatMessage): any {
    return {
      ...message,
      timestamp: message.timestamp.toISOString()
    };
  }

  private deserializeMessage(data: any): ChatMessage {
    return {
      ...data,
      timestamp: new Date(data.timestamp)
    };
  }

  private serializeTutoringSession(session: TutoringSession): any {
    return {
      ...session,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime?.toISOString()
    };
  }

  private deserializeTutoringSession(data: any): TutoringSession {
    return {
      ...data,
      startTime: new Date(data.startTime),
      endTime: data.endTime ? new Date(data.endTime) : undefined
    };
  }

  private serializeAnalytics(analytics: ChatAnalytics): any {
    return {
      ...analytics,
      generatedAt: analytics.generatedAt.toISOString()
    };
  }

  private deserializeAnalytics(data: any): ChatAnalytics {
    return {
      ...data,
      generatedAt: new Date(data.generatedAt)
    };
  }

  private saveToLocalStorage(key: string, data: any): void {
    try {
      const serialized = this.options.encryptData ? 
        this.encrypt(JSON.stringify(data)) : 
        JSON.stringify(data);
      
      localStorage.setItem(key, serialized);
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  private loadFromLocalStorage(key: string): any {
    try {
      const serialized = localStorage.getItem(key);
      if (!serialized) return null;

      const data = this.options.encryptData ? 
        this.decrypt(serialized) : 
        serialized;

      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  private async saveToIndexedDB(storeName: string, data: any): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async loadFromIndexedDB(storeName: string, key: string): Promise<any> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFromIndexedDB(storeName: string, key: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Additional implementation methods would go here...
  private encrypt(data: string): string {
    // Simple encryption for demo - use proper encryption in production
    return btoa(data);
  }

  private decrypt(encryptedData: string): string {
    // Simple decryption for demo - use proper decryption in production
    return atob(encryptedData);
  }

  private scheduleCleanup(): void {
    // Schedule periodic cleanup
    setInterval(() => {
      this.cleanup();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  // Placeholder implementations for missing methods
  private loadUserSessionsFromLocalStorage(userId: string): ChatSession[] {
    // Implementation would scan localStorage for user's sessions
    return [];
  }

  private async loadUserSessionsFromIndexedDB(userId: string): Promise<ChatSession[]> {
    // Implementation would query IndexedDB for user's sessions
    return [];
  }

  private deleteMessagesFromLocalStorage(sessionId: string): void {
    localStorage.removeItem(`messages_${sessionId}`);
  }

  private async deleteMessagesFromIndexedDB(sessionId: string): Promise<void> {
    // Implementation would delete messages by sessionId
  }

  private async saveMessagesToIndexedDB(messages: any[]): Promise<void> {
    // Implementation would save messages to IndexedDB
  }

  private async loadMessagesFromIndexedDB(sessionId: string): Promise<any[]> {
    // Implementation would load messages from IndexedDB
    return [];
  }

  private loadUserTutoringSessionsFromLocalStorage(userId: string): TutoringSession[] {
    // Implementation would scan localStorage for user's tutoring sessions
    return [];
  }

  private async loadUserTutoringSessionsFromIndexedDB(userId: string): Promise<TutoringSession[]> {
    // Implementation would query IndexedDB for user's tutoring sessions
    return [];
  }

  private getLocalStorageStats(): any {
    // Implementation would calculate localStorage stats
    return {
      totalSessions: 0,
      totalMessages: 0,
      totalSize: 0,
      oldestSession: null,
      newestSession: null
    };
  }

  private async getIndexedDBStats(): Promise<any> {
    // Implementation would calculate IndexedDB stats
    return {
      totalSessions: 0,
      totalMessages: 0,
      totalSize: 0,
      oldestSession: null,
      newestSession: null
    };
  }

  private async cleanupLocalStorage(cutoffDate: Date): Promise<void> {
    // Implementation would clean up old localStorage data
  }

  private async cleanupIndexedDB(cutoffDate: Date): Promise<void> {
    // Implementation would clean up old IndexedDB data
  }
}

// Export singleton instance
export const chatStorage = new ChatStorageService({
  persistenceType: 'localStorage',
  autoCleanup: true,
  retentionDays: 90
});

export default chatStorage;